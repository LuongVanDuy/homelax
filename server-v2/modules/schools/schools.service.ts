import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import {
  DEFAULT_SCHOOL_RADIUS_KM,
  effectiveSchoolRadiusKm,
  haversineDistanceKm,
  publicSchoolSchema,
  type PublicSchoolListQuery,
  type SchoolListQuery,
  type SchoolWrite,
} from '@tinyhouse/contracts';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { PostgresService } from '../../database/postgres.service.js';
import { PUBLIC_INVENTORY_CTE, schoolDistanceSql } from '../../common/public-inventory-query.js';
import {
  canAccessBuilding,
  mapBuildingRow,
} from '../../database/row-mappers.js';
import { AuditService } from '../audit/audit.service.js';

function mapSchool(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    shortName: String(row.short_name || ''),
    campus: String(row.campus || ''),
    type: String(row.school_type || ''),
    sector: String(row.sector || ''),
    address: String(row.address || ''),
    ward: String(row.ward || ''),
    latitude: row.latitude === null || row.latitude === undefined
      ? null
      : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined
      ? null
      : Number(row.longitude),
    radiusKm: row.radius_km === null || row.radius_km === undefined
      ? null
      : Number(row.radius_km),
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
    status: row.status || 'active',
    source: row.source || 'admin',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapPublicSchool(row: Record<string, any>) {
  const radiusKm = row.radius_km === null || row.radius_km === undefined
    ? null
    : Number(row.radius_km);
  return publicSchoolSchema.parse({
    id: String(row.id || ''),
    name: String(row.name || ''),
    campus: String(row.campus || ''),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusKm,
    effectiveRadiusKm: effectiveSchoolRadiusKm(radiusKm),
    radiusSource: radiusKm === null ? 'default' : 'school',
    status: 'active',
    availableUnitCount: Number(row.available_unit_count || 0),
  });
}

@Injectable()
export class SchoolsService {
  constructor(
    private readonly db: PostgresService,
    private readonly audit: AuditService,
  ) {}

  async publicList(query: PublicSchoolListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = query.sort === 'availableUnitCount' ? 'available_unit_count' : query.sort === 'campus'
      ? 'lower(s.campus)'
      : 'lower(s.name)';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const where = `
      WHERE s.status = 'active'
        AND s.latitude IS NOT NULL
        AND s.longitude IS NOT NULL
        AND ($3 = '' OR s.id = $3)
        AND (cardinality($4::text[]) = 0 OR s.id = ANY($4::text[]))
        AND (
          $1 = ''
          OR s.name ILIKE $2
          OR s.short_name ILIKE $2
          OR s.campus ILIKE $2
        )
    `;
    const params = [search, pattern, query.id || '', (query.ids || '').split(',').map(id => id.trim()).filter(Boolean)];
    const [rows, count] = await Promise.all([
      this.db.query(
        `
          WITH ${PUBLIC_INVENTORY_CTE}
          SELECT s.id, s.name, s.campus, s.latitude, s.longitude, s.radius_km,
            (SELECT COALESCE(SUM(pi.vacant_units), 0)::int
             FROM public_inventory pi JOIN buildings b ON b.id = pi.building_id
             WHERE b.latitude IS NOT NULL AND b.longitude IS NOT NULL
               AND ${schoolDistanceSql('b')} <= COALESCE(s.radius_km, ${DEFAULT_SCHOOL_RADIUS_KM})
            ) AS available_unit_count
          FROM schools s
          ${where}
          ORDER BY ${sortColumn} ${order}, lower(s.name) ASC, s.id ASC
          LIMIT $5 OFFSET $6
        `,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM schools s ${where}`,
        params,
      ),
    ]);

    return pageResult(
      rows.rows.map(mapPublicSchool),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async list(query: SchoolListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = {
      name: 'lower(s.name)',
      updatedAt: 's.updated_at',
      radiusKm: 's.radius_km',
      createdAt: 's.created_at',
    }[query.sort] || 'lower(s.name)';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const nulls = query.sort === 'radiusKm' ? ' NULLS LAST' : '';
    const where = `
      WHERE ($1 = '' OR s.status = $1)
        AND (
          $2 = ''
          OR ($2 = 'complete' AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL AND s.radius_km IS NOT NULL)
          OR ($2 = 'missingCoordinates' AND (s.latitude IS NULL OR s.longitude IS NULL))
          OR ($2 = 'missingRadius' AND s.radius_km IS NULL)
        )
        AND (
          $3 = ''
          OR s.name ILIKE $4
          OR s.short_name ILIKE $4
          OR s.campus ILIKE $4
          OR s.address ILIKE $4
          OR s.ward ILIKE $4
          OR COALESCE(s.keywords, '[]'::jsonb)::text ILIKE $4
        )
    `;
    const params = [query.status, query.location, search, pattern];

    const [rows, count] = await Promise.all([
      this.db.query(
        `
          SELECT s.*
          FROM schools s
          ${where}
          ORDER BY ${sortColumn} ${order}${nulls}, lower(s.name) ASC
          LIMIT $5 OFFSET $6
        `,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM schools s ${where}`,
        params,
      ),
    ]);

    return pageResult(
      rows.rows.map(mapSchool),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async buildingDistances(id: string, user: any) {
    const schoolResult = await this.db.query(
      'SELECT * FROM schools WHERE id = $1 LIMIT 1',
      [id],
    );
    if (!schoolResult.rows[0]) {
      throw new NotFoundException({ error: 'Trường học không tồn tại.' });
    }

    const school = mapSchool(schoolResult.rows[0]);
    if (school.latitude === null || school.longitude === null) {
      throw new ConflictException({
        error: 'Trường/cơ sở chưa có tọa độ nên chưa thể tính khoảng cách.',
      });
    }

    const buildingRows = await this.db.query(
      `
        SELECT *
        FROM buildings
        WHERE status = 'active'
          AND deleted_at IS NULL
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
      `,
    );

    const effectiveRadiusKm = effectiveSchoolRadiusKm(school.radiusKm);
    const radiusSource = school.radiusKm === null ? 'default' as const : 'school' as const;
    const buildings = buildingRows.rows
      .map(mapBuildingRow)
      .filter((building) => canAccessBuilding(building, user))
      .map((building) => {
        const distanceKm = haversineDistanceKm(
          { latitude: Number(school.latitude), longitude: Number(school.longitude) },
          { latitude: Number(building.latitude), longitude: Number(building.longitude) },
        );
        return {
          buildingId: building.id,
          buildingCode: building.code,
          buildingName: building.name,
          address: building.address,
          latitude: Number(building.latitude),
          longitude: Number(building.longitude),
          distanceKm,
          effectiveRadiusKm,
          radiusSource,
          withinRadius: distanceKm <= effectiveRadiusKm,
        };
      })
      .sort((left, right) => left.distanceKm - right.distanceKm);

    return {
      method: 'haversine' as const,
      unit: 'km' as const,
      defaultRadiusKm: DEFAULT_SCHOOL_RADIUS_KM,
      effectiveRadiusKm,
      radiusSource,
      school,
      buildings,
    };
  }

  async save(data: SchoolWrite, user: any, id?: string) {
    const existing = id
      ? await this.db.query('SELECT * FROM schools WHERE id = $1 LIMIT 1', [id])
      : null;
    if (id && !existing?.rows[0]) {
      throw new NotFoundException({ error: 'Trường học không tồn tại.' });
    }
    const current = existing?.rows[0] || null;

    const duplicate = await this.db.query<{ id: string }>(
      `
        SELECT id
        FROM schools
        WHERE lower(btrim(name)) = lower(btrim($1))
          AND lower(btrim(campus)) = lower(btrim($2))
          AND lower(btrim(address)) = lower(btrim($3))
          AND id <> $4
        LIMIT 1
      `,
      [data.name, data.campus, data.address, id || ''],
    );
    if (duplicate.rows[0]) {
      throw new ConflictException({
        error: 'Trường/cơ sở với địa chỉ này đã tồn tại.',
      });
    }

    const schoolId = id || `SCH-${crypto.randomUUID()}`;
    const result = await this.db.query(
      `
        INSERT INTO schools (
          id, name, short_name, campus, school_type, sector,
          address, ward, latitude, longitude, radius_km,
          keywords, status, source, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          campus = EXCLUDED.campus,
          address = EXCLUDED.address,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          radius_km = EXCLUDED.radius_km,
          updated_at = NOW()
        RETURNING *
      `,
      [
        schoolId,
        data.name,
        current?.short_name || '',
        data.campus,
        current?.school_type || '',
        current?.sector || '',
        data.address,
        current?.ward || '',
        data.latitude,
        data.longitude,
        data.radiusKm,
        JSON.stringify(Array.isArray(current?.keywords) ? current.keywords : []),
        current?.status || 'active',
        current?.source || 'admin',
      ],
    );

    await this.audit.create({
      user,
      action: current ? 'UPDATE' : 'CREATE',
      entityType: 'school',
      entityId: schoolId,
      summary: `${user?.name || 'Admin'} đã ${current ? 'cập nhật' : 'tạo'} trường ${data.name}`,
    }).catch(() => undefined);

    return mapSchool(result.rows[0]);
  }

  archive(id: string, user: any) {
    return this.setStatus(id, 'archived', user);
  }

  restore(id: string, user: any) {
    return this.setStatus(id, 'active', user);
  }

  async remove(id: string, user: any) {
    const current = await this.db.query(
      'SELECT * FROM schools WHERE id = $1 LIMIT 1',
      [id],
    );
    if (!current.rows[0]) {
      throw new NotFoundException({ error: 'Trường học không tồn tại.' });
    }

    await this.db.query('DELETE FROM schools WHERE id = $1', [id]);
    await this.audit.create({
      user,
      action: 'DELETE',
      entityType: 'school',
      entityId: id,
      summary: `${user?.name || 'Admin'} đã xóa trường ${current.rows[0].name}`,
    }).catch(() => undefined);

    return { success: true, id };
  }

  private async setStatus(
    id: string,
    status: 'active' | 'archived',
    user: any,
  ) {
    const result = await this.db.query(
      'UPDATE schools SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, status],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({ error: 'Trường học không tồn tại.' });
    }

    await this.audit.create({
      user,
      action: status === 'archived' ? 'ARCHIVE' : 'RESTORE',
      entityType: 'school',
      entityId: id,
      summary: `${user?.name || 'Admin'} đã ${status === 'archived' ? 'lưu trữ' : 'khôi phục'} trường ${result.rows[0].name}`,
    }).catch(() => undefined);

    return mapSchool(result.rows[0]);
  }
}
