import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import type { PoolClient } from 'pg';
import {
  publicAmenitySchema,
  type AmenityListQuery,
  type AmenityScope,
  type AmenityWrite,
  type PublicAmenityListQuery,
} from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import { AuditService } from '../audit/audit.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';

function mapAmenity(row: Record<string, any>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    scope: row.scope,
    category: row.category,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    source: row.source || 'admin',
    assignmentCount: Number(row.assignment_count || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapPublicAmenity(row: Record<string, any>) {
  return publicAmenitySchema.parse({
    id: String(row.id),
    name: String(row.name),
    scope: row.scope,
    category: row.category,
    sortOrder: Number(row.sort_order),
    status: 'active',
  });
}

@Injectable()
export class AmenitiesService {
  constructor(
    private readonly db: PostgresService,
    private readonly audit: AuditService,
  ) {}

  async publicList(query: PublicAmenityListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = query.sort === 'name' ? 'lower(a.name)' : 'a.sort_order';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const where = `
      WHERE a.status = 'active'
        AND ($1 = '' OR a.scope = $1)
        AND ($2 = '' OR a.category = $2)
        AND ($3 = '' OR a.name ILIKE $4)
        AND (cardinality($5::text[]) = 0 OR a.id = ANY($5::text[]))
    `;
    const params = [query.scope, query.category, search, pattern, (query.ids || '').split(',').map(id => id.trim()).filter(Boolean)];
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT a.id, a.name, a.scope, a.category, a.sort_order
         FROM amenities a ${where}
         ORDER BY ${sortColumn} ${order}, lower(a.name) ASC, a.id ASC
         LIMIT $6 OFFSET $7`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM amenities a ${where}`,
        params,
      ),
    ]);

    return pageResult(
      rows.rows.map(mapPublicAmenity),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async list(query: AmenityListQuery) {
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const sortColumn = {
      sortOrder: 'a.sort_order',
      name: 'lower(a.name)',
      assignmentCount: 'assignment_count',
      createdAt: 'a.created_at',
    }[query.sort] || 'a.sort_order';
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const where = `
      WHERE ($1 = '' OR a.scope = $1)
        AND ($2 = '' OR a.status = $2)
        AND ($3 = '' OR a.category = $3)
        AND ($4 = '' OR a.name ILIKE $5 OR a.code ILIKE $5)
        AND ($6::text[] = '{}'::text[] OR a.id = ANY($6::text[]))
    `;
    const ids = query.ids ? query.ids.split(',').map((id) => id.trim()).filter(Boolean) : [];
    const params = [query.scope, query.status, query.category, search, pattern, ids];
    const base = `
      SELECT a.*,
        (
          SELECT COUNT(*) FROM building_amenities ba WHERE ba.amenity_id = a.id
        ) + (
          SELECT COUNT(*) FROM room_type_amenities ra WHERE ra.amenity_id = a.id
        ) AS assignment_count
      FROM amenities a
      ${where}
    `;
    const [rows, count] = await Promise.all([
      this.db.query(
        `${base}
         ORDER BY ${sortColumn} ${order}, lower(a.name) ASC
         LIMIT $7 OFFSET $8`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM amenities a ${where}`,
        params,
      ),
    ]);
    return pageResult(
      rows.rows.map(mapAmenity),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async save(data: AmenityWrite, user: any, id?: string) {
    const existing = id
      ? await this.db.query('SELECT * FROM amenities WHERE id = $1 LIMIT 1', [id])
      : null;
    if (id && !existing?.rows[0]) {
      throw new NotFoundException({ error: 'Tiện ích không tồn tại.' });
    }
    const current = existing?.rows[0] || null;
    if (current && current.scope !== data.scope) {
      const assigned = await this.assignmentCount(id!);
      if (assigned > 0) {
        throw new ConflictException({
          error: 'Tiện ích đã được gán nên không thể đổi phạm vi tòa/phòng.',
        });
      }
    }

    const duplicate = await this.db.query<{ id: string }>(
      `
        SELECT id FROM amenities
        WHERE scope = $1 AND lower(btrim(name)) = lower(btrim($2))
          AND id <> $3
        LIMIT 1
      `,
      [data.scope, data.name, id || ''],
    );
    if (duplicate.rows[0]) {
      throw new ConflictException({ error: 'Tên tiện ích đã tồn tại trong phạm vi này.' });
    }

    const amenityId = id || `AMN-${crypto.randomUUID()}`;
    const code = current?.code || `AMN-${data.scope === 'building' ? 'BLD' : 'ROOM'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await this.db.query(
      `
        INSERT INTO amenities (
          id, code, name, scope, category, status, sort_order, source, updated_at
        ) VALUES ($1,$2,$3,$4,$5,'active',$6,'admin',NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          scope = EXCLUDED.scope,
          category = EXCLUDED.category,
          sort_order = EXCLUDED.sort_order,
          updated_at = NOW()
        RETURNING *
      `,
      [amenityId, code, data.name, data.scope, data.category, data.sortOrder],
    );

    if (current) await this.refreshLegacyForAmenity(amenityId, data.scope);
    await this.audit.create({
      user,
      action: current ? 'UPDATE' : 'CREATE',
      entityType: 'amenity',
      entityId: amenityId,
      summary: `${user?.name || 'Admin'} đã ${current ? 'cập nhật' : 'tạo'} tiện ích ${data.name}`,
    }).catch(() => undefined);

    const count = await this.assignmentCount(amenityId);
    return mapAmenity({ ...result.rows[0], assignment_count: count });
  }

  async archive(id: string, user: any) {
    return this.setStatus(id, 'archived', user);
  }

  async restore(id: string, user: any) {
    return this.setStatus(id, 'active', user);
  }

  async remove(id: string, user: any) {
    const current = await this.db.query('SELECT * FROM amenities WHERE id = $1 LIMIT 1', [id]);
    if (!current.rows[0]) throw new NotFoundException({ error: 'Tiện ích không tồn tại.' });
    const assigned = await this.assignmentCount(id);
    if (assigned > 0) {
      throw new ConflictException({
        error: 'Tiện ích đang được sử dụng. Hãy lưu trữ thay vì xóa.',
      });
    }
    await this.db.query('DELETE FROM amenities WHERE id = $1', [id]);
    await this.audit.create({
      user,
      action: 'DELETE',
      entityType: 'amenity',
      entityId: id,
      summary: `${user?.name || 'Admin'} đã xóa tiện ích ${current.rows[0].name}`,
    }).catch(() => undefined);
    return { success: true, id };
  }

  async syncBuildingAssignments(buildingId: string, amenityIds: string[]) {
    return this.syncAssignments('building', buildingId, amenityIds);
  }

  async syncRoomAssignments(roomTypeId: string, amenityIds: string[]) {
    return this.syncAssignments('room', roomTypeId, amenityIds);
  }

  private async setStatus(id: string, status: 'active' | 'archived', user: any) {
    const result = await this.db.query(
      'UPDATE amenities SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, status],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'Tiện ích không tồn tại.' });
    await this.audit.create({
      user,
      action: status === 'archived' ? 'ARCHIVE' : 'RESTORE',
      entityType: 'amenity',
      entityId: id,
      summary: `${user?.name || 'Admin'} đã ${status === 'archived' ? 'lưu trữ' : 'khôi phục'} tiện ích ${result.rows[0].name}`,
    }).catch(() => undefined);
    const count = await this.assignmentCount(id);
    return mapAmenity({ ...result.rows[0], assignment_count: count });
  }

  private async assignmentCount(id: string) {
    const result = await this.db.query<{ count: number }>(
      `
        SELECT (
          (SELECT COUNT(*) FROM building_amenities WHERE amenity_id = $1) +
          (SELECT COUNT(*) FROM room_type_amenities WHERE amenity_id = $1)
        )::int AS count
      `,
      [id],
    );
    return Number(result.rows[0]?.count || 0);
  }

  private async syncAssignments(scope: AmenityScope, entityId: string, amenityIds: string[]) {
    await this.db.transaction(async (client) => {
      if (amenityIds.length) {
        const valid = await client.query<{ id: string }>(
          'SELECT id FROM amenities WHERE scope = $1 AND id = ANY($2::text[])',
          [scope, amenityIds],
        );
        if (valid.rows.length !== amenityIds.length) {
          throw new ConflictException({
            error: 'Danh sách tiện ích chứa mục không tồn tại hoặc sai phạm vi.',
          });
        }
      }
      const table = scope === 'building' ? 'building_amenities' : 'room_type_amenities';
      const entityColumn = scope === 'building' ? 'building_id' : 'room_type_id';
      await client.query(`DELETE FROM ${table} WHERE ${entityColumn} = $1`, [entityId]);
      for (const amenityId of amenityIds) {
        await client.query(
          `INSERT INTO ${table} (${entityColumn}, amenity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [entityId, amenityId],
        );
      }
      await this.syncLegacy(client, scope, entityId);
    });
  }

  private async refreshLegacyForAmenity(id: string, scope: AmenityScope) {
    const table = scope === 'building' ? 'building_amenities' : 'room_type_amenities';
    const entityColumn = scope === 'building' ? 'building_id' : 'room_type_id';
    const entities = await this.db.query<{ entity_id: string }>(
      `SELECT DISTINCT ${entityColumn} AS entity_id FROM ${table} WHERE amenity_id = $1`,
      [id],
    );
    for (const row of entities.rows) {
      await this.db.transaction((client) => this.syncLegacy(client, scope, row.entity_id));
    }
  }

  private async syncLegacy(client: PoolClient, scope: AmenityScope, entityId: string) {
    if (scope === 'building') {
      await client.query(
        `
          WITH selected AS (
            SELECT a.name, a.category, a.sort_order
            FROM building_amenities ba
            JOIN amenities a ON a.id = ba.amenity_id
            WHERE ba.building_id = $1
          ), grouped AS (
            SELECT
              COALESCE(jsonb_agg(name ORDER BY sort_order, name), '[]'::jsonb) AS all_items,
              COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (WHERE category = 'building_common'), '[]'::jsonb) AS common_items,
              COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (WHERE category = 'building_security'), '[]'::jsonb) AS security_items,
              COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (WHERE category IN ('building_fire_safety','building_other')), '[]'::jsonb) AS fire_items
            FROM selected
          )
          UPDATE buildings b SET
            amenities_building = g.all_items,
            amenities_building_chung = g.common_items,
            amenities_building_an_ninh = g.security_items,
            amenities_building_pccc = g.fire_items,
            amenities_pccc = g.fire_items,
            amenities_building_thoat_nan = '[]'::jsonb,
            updated_at = NOW()
          FROM grouped g
          WHERE b.id = $1
        `,
        [entityId],
      );
      return;
    }

    await client.query(
      `
        WITH selected AS (
          SELECT a.name, a.category, a.sort_order
          FROM room_type_amenities ra
          JOIN amenities a ON a.id = ra.amenity_id
          WHERE ra.room_type_id = $1
        ), grouped AS (
          SELECT
            COALESCE(jsonb_agg(name ORDER BY sort_order, name), '[]'::jsonb) AS all_items,
            COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (WHERE category = 'room_furniture'), '[]'::jsonb) AS furniture_items,
            COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (WHERE category = 'room_electrical'), '[]'::jsonb) AS electrical_items,
            COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (WHERE category = 'room_other'), '[]'::jsonb) AS other_items,
            COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (WHERE category = 'room_fire_safety'), '[]'::jsonb) AS fire_items,
            COALESCE(jsonb_agg(name ORDER BY sort_order, name) FILTER (
              WHERE lower(name) LIKE '%bếp%' OR lower(name) LIKE '%rửa bát%' OR lower(name) LIKE '%xoong%' OR lower(name) LIKE '%nồi%'
            ), '[]'::jsonb) AS kitchen_items
          FROM selected
        )
        UPDATE rooms r SET
          amenities = g.all_items,
          amenities_rieng = g.all_items,
          amenities_noi_that = g.furniture_items,
          amenities_thiet_bi_dien = g.electrical_items,
          amenities_khu_vuc_bep = g.kitchen_items,
          amenities_dac_diem_rieng = g.other_items,
          amenities_an_toan = g.fire_items,
          amenities_pccc = g.fire_items,
          updated_at = NOW()
        FROM grouped g
        WHERE r.id = $1
      `,
      [entityId],
    );
  }
}
