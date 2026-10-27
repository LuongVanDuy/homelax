import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import type { RoomListQuery, PublicRoomSearchQuery } from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import {
  canAccessBuilding,
  isPrivilegedBuildingRole,
  mapBuildingRow,
  mapRoomRow,
  mapRoomUnitRow,
} from '../../database/row-mappers.js';
import { AuditService } from '../audit/audit.service.js';
import { AmenitiesService } from '../amenities/amenities.service.js';
import { BuildingsService } from '../buildings/buildings.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { toPublicRoom, withPublicAmenities } from '../../common/public-inventory.js';
import { publicAmenitiesSql } from '../../common/public-inventory-query.js';
import { searchPublicRooms } from './public-room-search.js';

const roomWithUnitsSelect = (publicRead = false) => `
  SELECT
    r.*,
    rtc.name AS room_type_catalog_name,
    rtc.status AS room_type_catalog_status,
    ${publicRead ? `${publicAmenitiesSql('room', 'r')} AS public_amenities,` : ''}
    to_jsonb(public_parent) AS public_parent,
    COALESCE(inventory.room_units, '[]'::jsonb) AS room_units,
    COALESCE(inventory.total_units, 0)::int AS total_units,
    COALESCE(inventory.vacant_units, 0)::int AS vacant_units,
    inventory.next_available_from,
    COALESCE((
      SELECT jsonb_agg(ra.amenity_id ORDER BY a.sort_order, lower(a.name))
      FROM room_type_amenities ra JOIN amenities a ON a.id = ra.amenity_id
      WHERE ra.room_type_id = r.id
    ), '[]'::jsonb) AS amenity_ids
  FROM rooms r
  JOIN room_type_catalog rtc ON rtc.id = r.room_type_catalog_id
  LEFT JOIN buildings public_parent ON public_parent.id = r.building_id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        jsonb_agg(to_jsonb(u) ORDER BY lower(u.code)),
        '[]'::jsonb
      ) AS room_units,
      count(*) FILTER (WHERE u.status <> 'archived')::int AS total_units,
      count(*) FILTER (WHERE u.status = 'available')::int AS vacant_units,
      min(u.available_from) FILTER (
        WHERE u.status IN ('occupied', 'maintenance')
          AND u.available_from IS NOT NULL
      ) AS next_available_from
    FROM room_units u
    WHERE u.room_type_id = r.id
      ${publicRead ? 'AND u.building_id = r.building_id' : ''}
  ) inventory ON TRUE
`;

@Injectable()
export class RoomsService {
  constructor(
    private readonly db: PostgresService,
    private readonly buildings: BuildingsService,
    private readonly audit: AuditService,
    private readonly amenities: AmenitiesService,
  ) {}

  publicSearch(query: PublicRoomSearchQuery) {
    return searchPublicRooms(this.db, query);
  }

  private async rawRows() {
    const result = await this.db.query(
      `${roomWithUnitsSelect()} ORDER BY r.created_at DESC`,
    );
    return result.rows.map(mapRoomRow);
  }

  private async rawDetail(id: string) {
    const result = await this.db.query(
      `${roomWithUnitsSelect()}
       WHERE lower(r.id) = lower($1)
          OR lower(COALESCE(r.room_type_id, '')) = lower($1)
       LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapRoomRow(result.rows[0]) : null;
  }

  private async buildingForRoom(room: Record<string, any>) {
    const result = await this.db.query(
      `
        SELECT *
        FROM buildings
        WHERE id = $1
           OR lower(code) = lower($2)
        LIMIT 1
      `,
      [
        room.buildingId || room.building_id || null,
        room.buildingCode || room.building_code || '',
      ],
    );
    return result.rows[0] ? mapBuildingRow(result.rows[0]) : null;
  }

  private roomOwnerAccess(room: Record<string, any>, user: any) {
    if (!user) return false;
    if (isPrivilegedBuildingRole(user.roleCode)) return true;
    const uid = String(user.id || '').trim().toLowerCase();
    return (
      String(room.ownerId || room.owner_id || '').trim().toLowerCase() === uid ||
      String(room.createdBy || room.created_by || '').trim().toLowerCase() === uid
    );
  }

  private async canManageRoom(room: Record<string, any>, user: any) {
    if (this.roomOwnerAccess(room, user)) return true;
    const building = await this.buildingForRoom(room);
    return building ? canAccessBuilding(building, user) : false;
  }

  private async requireManageRoom(id: string, user: any) {
    const room = await this.rawDetail(id);
    if (!room) throw new NotFoundException({ error: 'Loại phòng không tồn tại.' });
    if (!(await this.canManageRoom(room, user))) {
      throw new ForbiddenException({ error: 'Bạn không có quyền quản lý loại phòng này.' });
    }
    return room;
  }

  async list(user: any, query: RoomListQuery) {
    const isCmsScope = this.buildings.assertCmsReadAccess(user, query.scope);
    const requireAccess = Boolean(
      isCmsScope && user && !isPrivilegedBuildingRole(user.roleCode),
    );
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const effectiveLifecycle = isCmsScope ? query.lifecycleStatus : 'active';
    const sortColumn = {
      updatedAt: 'r.updated_at',
      type: 'lower(r.type)',
      price: 'r.price',
      vacantCount: 'r.vacant_units',
    }[query.sort] || 'r.updated_at';
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const where = `
      WHERE ($1 = '' OR r.type ILIKE $2 OR r.building_code ILIKE $2 OR r.building_name ILIKE $2
        OR EXISTS (
          SELECT 1 FROM room_units su
          WHERE su.room_type_id = r.id AND su.code ILIKE $2
            ${isCmsScope ? '' : "AND su.status IN ('available', 'occupied', 'maintenance') AND su.building_id = r.building_id"}
        ))
        AND ($3 = '' OR r.lifecycle_status = $3)
        ${isCmsScope ? '' : "AND r.deleted_at IS NULL AND r.public_parent->>'status' = 'active' AND (r.public_parent->>'deleted_at') IS NULL"}
        AND ($4 = '' OR r.building_id = $4 OR lower(r.building_code) = lower($4))
        AND (
          $5 = ''
          OR ($5 = 'available' AND r.vacant_units > 0)
          OR ($5 = 'full' AND r.total_units > 0 AND r.vacant_units = 0)
          OR ($5 = 'empty' AND r.total_units = 0)
        )
        AND (
          $6::boolean = FALSE
          OR r.owner_id = $7
          OR r.created_by = $7
          OR EXISTS (
            SELECT 1 FROM buildings b
            WHERE b.id = r.building_id
              AND (
                b.owner_id = $7
                OR b.created_by = $7
                OR COALESCE(b.allowed_viewer_ids, '[]'::jsonb) ? $7
              )
          )
        )
    `;
    const params = [
      search,
      pattern,
      effectiveLifecycle,
      query.building,
      query.availability,
      requireAccess,
      String(user?.id || ''),
    ];
    const cte = `WITH room_data AS (${roomWithUnitsSelect(!isCmsScope)})`;
    const [rows, count] = await Promise.all([
      this.db.query(
        `${cte}
         SELECT * FROM room_data r
         ${where}
         ORDER BY ${sortColumn} ${order}, r.id DESC
         LIMIT $8 OFFSET $9`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `${cte}
         SELECT COUNT(*)::int AS count FROM room_data r ${where}`,
        params,
      ),
    ]);
    return pageResult(
      rows.rows.map((row) => isCmsScope ? mapRoomRow(row)
        : toPublicRoom(withPublicAmenities(mapRoomRow(row), row.public_amenities), mapBuildingRow(row.public_parent))),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async byBuilding(buildingIdOrCode: string, query: RoomListQuery) {
    return this.list(null, {
      ...query,
      scope: 'public',
      building: buildingIdOrCode,
      lifecycleStatus: 'active',
      availability: 'available',
    });
  }

  async stats(user: any) {
    this.buildings.assertCmsReadAccess(user, 'cms');
    const requireAccess = Boolean(
      user && !isPrivilegedBuildingRole(user.roleCode),
    );
    const result = await this.db.query<{
      active_types: number;
      archived_types: number;
      total_units: number;
      vacant_units: number;
    }>(
      `
        SELECT
          COUNT(DISTINCT r.id) FILTER (WHERE r.lifecycle_status = 'active')::int AS active_types,
          COUNT(DISTINCT r.id) FILTER (WHERE r.lifecycle_status = 'archived')::int AS archived_types,
          COUNT(u.id) FILTER (
            WHERE r.lifecycle_status = 'active' AND u.status <> 'archived'
          )::int AS total_units,
          COUNT(u.id) FILTER (
            WHERE r.lifecycle_status = 'active' AND u.status = 'available'
          )::int AS vacant_units
        FROM rooms r
        LEFT JOIN room_units u ON u.room_type_id = r.id
        LEFT JOIN buildings b ON b.id = r.building_id
        WHERE (
          $1::boolean = FALSE
          OR r.owner_id = $2
          OR r.created_by = $2
          OR b.owner_id = $2
          OR b.created_by = $2
          OR COALESCE(b.allowed_viewer_ids, '[]'::jsonb) ? $2
        )
      `,
      [requireAccess, String(user?.id || '')],
    );
    const row = result.rows[0] || {
      active_types: 0,
      archived_types: 0,
      total_units: 0,
      vacant_units: 0,
    };
    return {
      activeTypes: Number(row.active_types || 0),
      archivedTypes: Number(row.archived_types || 0),
      totalUnits: Number(row.total_units || 0),
      vacantUnits: Number(row.vacant_units || 0),
    };
  }

  async detail(id: string, user: any, scope = 'public') {
    const isCmsScope = this.buildings.assertCmsReadAccess(user, scope);
    if (!isCmsScope) {
      const result = await this.db.query(
        `${roomWithUnitsSelect(true)}
         WHERE (lower(r.id) = lower($1) OR lower(COALESCE(r.room_type_id, '')) = lower($1))
           AND r.deleted_at IS NULL AND r.lifecycle_status IN ('active', 'archived')
           AND public_parent.deleted_at IS NULL AND public_parent.status IN ('active', 'archived')
         LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException({ error: 'Không tìm thấy thông tin phòng.' });
      return toPublicRoom(withPublicAmenities(mapRoomRow(row), row.public_amenities), mapBuildingRow(row.public_parent));
    }
    const room = await this.rawDetail(id);
    if (!room || (!isCmsScope && room.lifecycleStatus !== 'active')) {
      throw new NotFoundException({ error: 'Room not found' });
    }
    if (isCmsScope && user && !(await this.canManageRoom(room, user))) {
      throw new ForbiddenException({ error: 'Bạn không có quyền xem phòng này.' });
    }
    return room;
  }

  private async resolveBuilding(data: Record<string, any>) {
    const id = String(data.buildingId || data.building_id || '').trim();
    const code = String(data.buildingCode || data.building_code || '').trim();
    const result = await this.db.query(
      `
        SELECT *
        FROM buildings
        WHERE ($1 <> '' AND id = $1)
           OR ($2 <> '' AND lower(code) = lower($2))
        LIMIT 1
      `,
      [id, code],
    );
    return result.rows[0] ? mapBuildingRow(result.rows[0]) : null;
  }

  async save(data: Record<string, any>, user: any) {
    const building = await this.resolveBuilding(data);
    if (!building) {
      throw new HttpException({ error: 'Không tìm thấy tòa nhà của loại phòng.' }, HttpStatus.BAD_REQUEST);
    }
    if (!canAccessBuilding(building, user)) {
      throw new ForbiddenException({ error: 'Bạn không có quyền thêm/sửa loại phòng của tòa nhà này.' });
    }

    const lookup = String(data.id || '').trim();
    const existing = lookup ? await this.rawDetail(lookup) : null;
    if (existing && !(await this.canManageRoom(existing, user))) {
      throw new ForbiddenException({ error: 'Bạn không có quyền chỉnh sửa loại phòng này.' });
    }

    if (
      existing &&
      existing.buildingId &&
      existing.buildingId !== building.id &&
      Number(existing.totalUnits || 0) > 0
    ) {
      throw new HttpException(
        { error: 'Loại phòng đã có căn vật lý nên không thể chuyển sang tòa khác. Hãy xử lý các căn trước.' },
        HttpStatus.CONFLICT,
      );
    }

    const catalogId = String(data.roomTypeCatalogId || existing?.roomTypeCatalogId || '').trim();
    const catalogResult = await this.db.query(
      'SELECT id, name, status FROM room_type_catalog WHERE id = $1 LIMIT 1',
      [catalogId],
    );
    const catalog = catalogResult.rows[0];
    if (!catalog) {
      throw new HttpException({ error: 'Loại phòng đã chọn không tồn tại.' }, HttpStatus.BAD_REQUEST);
    }
    const catalogChanged = !existing || existing.roomTypeCatalogId !== catalogId;
    if (catalog.status !== 'active' && catalogChanged) {
      throw new HttpException({ error: 'Loại phòng đã chọn đang được lưu trữ. Hãy chọn loại đang hoạt động.' }, HttpStatus.CONFLICT);
    }
    // Preserve a legacy variant label when editing unrelated fields. Reclassifying
    // intentionally normalizes the display snapshot to the selected catalog name.
    const cleanType = existing && !catalogChanged
      ? String(existing.type || catalog.name).trim()
      : String(catalog.name).trim();

    const id = existing?.id || String(data.id || `RM-${Date.now()}-${crypto.randomInt(100, 999)}`);

    const result = await this.db.query(
      `
        INSERT INTO rooms (
          id, room_type_id, building_id, building_code, building_name,
          room_number, specific_rooms, status, lifecycle_status,
          price, type, room_type_catalog_id, area, max_occupants, available_from,
          cover_image, images, media_360, description, amenities,
          amenities_noi_that, amenities_thiet_bi_dien,
          amenities_khu_vuc_bep, amenities_dac_diem_rieng,
          amenities_rieng, amenities_chung, amenities_an_ninh,
          amenities_pccc, amenities_an_toan, owner_id, created_by,
          deleted_at, audience_groups, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,
          $16,$17::jsonb,$18::jsonb,$19,$20::jsonb,$21::jsonb,$22::jsonb,
          $23::jsonb,$24::jsonb,$25::jsonb,$26::jsonb,$27::jsonb,
          $28::jsonb,$29::jsonb,$30,$31,$32,$33::jsonb,NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          building_id = EXCLUDED.building_id,
          building_code = EXCLUDED.building_code,
          building_name = EXCLUDED.building_name,
          lifecycle_status = EXCLUDED.lifecycle_status,
          price = EXCLUDED.price,
          type = EXCLUDED.type,
          room_type_catalog_id = EXCLUDED.room_type_catalog_id,
          audience_groups = EXCLUDED.audience_groups,
          area = EXCLUDED.area,
          max_occupants = EXCLUDED.max_occupants,
          cover_image = EXCLUDED.cover_image,
          images = EXCLUDED.images,
          media_360 = EXCLUDED.media_360,
          description = EXCLUDED.description,
          owner_id = EXCLUDED.owner_id,
          created_by = EXCLUDED.created_by,
          updated_at = NOW()
        RETURNING *
      `,
      [
        id,
        id,
        building.id,
        building.code,
        building.name,
        existing?.roomNumber || '',
        JSON.stringify(existing?.specificRooms || []),
        '',
        existing?.lifecycleStatus || 'active',
        Number(data.price ?? existing?.price ?? 0),
        cleanType,
        catalogId,
        Number(data.area ?? existing?.area ?? 25),
        Number(data.maxOccupants ?? existing?.maxOccupants ?? 2),
        '',
        String(data.coverImage ?? existing?.coverImage ?? ''),
        JSON.stringify(data.images ?? existing?.images ?? []),
        JSON.stringify(data.media360 ?? existing?.media360 ?? []),
        String(data.description ?? existing?.description ?? ''),
        JSON.stringify(existing?.amenities || []),
        JSON.stringify(existing?.amenitiesNoiThat || []),
        JSON.stringify(existing?.amenitiesThietBiDien || []),
        JSON.stringify(existing?.amenitiesKhuVucBep || []),
        JSON.stringify(existing?.amenitiesDacDiemRieng || []),
        JSON.stringify(existing?.amenitiesRieng || []),
        JSON.stringify(existing?.amenitiesChung || []),
        JSON.stringify(existing?.amenitiesAnNinh || []),
        JSON.stringify(existing?.amenitiesPccc || []),
        JSON.stringify(existing?.amenitiesAnToan || []),
        existing?.ownerId || user?.id || '',
        existing?.createdBy || user?.id || '',
        existing?.deletedAt || null,
        JSON.stringify(data.audienceGroups ?? existing?.audienceGroups ?? []),
      ],
    );

    if (Array.isArray(data.amenityIds)) {
      await this.amenities.syncRoomAssignments(id, data.amenityIds);
    }

    const previousBuilding = existing?.buildingId;
    await this.buildings.updateDerivedStats(building.id);
    if (previousBuilding && previousBuilding !== building.id) {
      await this.buildings.updateDerivedStats(previousBuilding);
    }

    const saved = await this.rawDetail(id);
    await this.audit.create({
      user,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'room_type',
      entityId: id,
      summary: `${user?.name || 'Admin'} đã ${existing ? 'cập nhật' : 'tạo'} loại phòng ${cleanType}`,
    }).catch(() => undefined);

    return saved || mapRoomRow(result.rows[0]);
  }

  private async unitRow(roomTypeId: string, unitId: string) {
    const result = await this.db.query(
      'SELECT * FROM room_units WHERE id = $1 AND room_type_id = $2 LIMIT 1',
      [unitId, roomTypeId],
    );
    return result.rows[0] ? mapRoomUnitRow(result.rows[0]) : null;
  }

  private normalizeAvailableFrom(status: string, value: unknown) {
    if (status === 'available' || status === 'archived') return null;
    const text = String(value || '').trim();
    return text || null;
  }

  private async bookingCountForUnit(
    buildingId: string,
    buildingCode: string,
    code: string,
  ) {
    const result = await this.db.query<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count FROM bookings
        WHERE (building_id = $1 OR lower(COALESCE(building_code, '')) = lower($2))
          AND lower(COALESCE(room_number, '')) = lower($3)
      `,
      [buildingId, buildingCode, code],
    );
    return Number(result.rows[0]?.count || 0);
  }

  async saveUnit(roomTypeId: string, unitId: string | null, data: Record<string, any>, user: any) {
    const room = await this.requireManageRoom(roomTypeId, user);
    if (room.lifecycleStatus === 'archived') {
      throw new HttpException({ error: 'Hãy khôi phục loại phòng trước khi sửa danh sách căn.' }, HttpStatus.CONFLICT);
    }

    const existing = unitId ? await this.unitRow(room.id, unitId) : null;
    if (unitId && !existing) {
      throw new NotFoundException({ error: 'Căn vật lý không tồn tại.' });
    }

    const code = String(data.code || existing?.code || '').trim();
    const status = String(data.status || existing?.status || 'available');

    const duplicate = await this.db.query<{ id: string }>(
      `
        SELECT id FROM room_units
        WHERE building_id = $1
          AND lower(code) = lower($2)
          AND id <> $3
        LIMIT 1
      `,
      [room.buildingId, code, String(existing?.id || '')],
    );
    if (duplicate.rows[0]) {
      throw new HttpException(
        { error: `Mã căn "${code}" đã tồn tại trong tòa ${room.buildingCode}.` },
        HttpStatus.CONFLICT,
      );
    }

    if (existing && existing.code.toLowerCase() !== code.toLowerCase()) {
      const bookings = await this.bookingCountForUnit(room.buildingId, room.buildingCode, existing.code);
      if (bookings > 0) {
        throw new HttpException(
          { error: 'Căn đã có lịch xem trong lịch sử nên không thể đổi mã. Hãy lưu trữ căn cũ và tạo căn mới.' },
          HttpStatus.CONFLICT,
        );
      }
    }

    const id = existing?.id || `RU-${Date.now()}-${crypto.randomInt(100, 999)}`;
    const availableFrom = this.normalizeAvailableFrom(status, data.availableFrom);
    const result = await this.db.query(
      `
        INSERT INTO room_units (
          id, room_type_id, building_id, code,
          status, available_from, migration_source, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'u04_3_admin',NOW())
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          status = EXCLUDED.status,
          available_from = EXCLUDED.available_from,
          migration_source = 'u04_3_admin',
          updated_at = NOW()
        RETURNING *
      `,
      [id, room.id, room.buildingId, code, status, availableFrom],
    );

    await this.buildings.updateDerivedStats(room.buildingId);
    const saved = mapRoomUnitRow(result.rows[0]);
    await this.audit.create({
      user,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'room_unit',
      entityId: saved.id,
      summary: `${user?.name || 'Admin'} đã ${existing ? 'cập nhật' : 'tạo'} căn ${saved.code}`,
    }).catch(() => undefined);
    return saved;
  }

  async removeUnit(roomTypeId: string, unitId: string, user: any) {
    const room = await this.requireManageRoom(roomTypeId, user);
    const unit = await this.unitRow(room.id, unitId);
    if (!unit) throw new NotFoundException({ error: 'Căn vật lý không tồn tại.' });

    const bookings = await this.bookingCountForUnit(room.buildingId, room.buildingCode, unit.code);
    if (bookings > 0) {
      throw new HttpException(
        { error: 'Căn đã có lịch xem. Hãy chuyển trạng thái sang Lưu trữ thay vì xóa vĩnh viễn.' },
        HttpStatus.CONFLICT,
      );
    }

    await this.db.query('DELETE FROM room_units WHERE id = $1 AND room_type_id = $2', [unit.id, room.id]);
    await this.buildings.updateDerivedStats(room.buildingId);
    await this.audit.create({
      user,
      action: 'DELETE',
      entityType: 'room_unit',
      entityId: unit.id,
      summary: `${user?.name || 'Admin'} đã xóa căn ${unit.code}`,
    }).catch(() => undefined);
    return { success: true, id: unit.id };
  }

  async remove(id: string, user: any) {
    if (!['admin', 'superadmin'].includes(String(user?.roleCode || '').toLowerCase())) {
      throw new ForbiddenException({ error: 'Chỉ quản trị viên mới được xóa vĩnh viễn loại phòng.' });
    }

    const room = await this.rawDetail(id);
    if (!room) throw new NotFoundException({ error: 'Loại phòng không tồn tại.' });

    const dependencies = await this.db.query<{
      units: number;
      bookings: number;
    }>(
      `
        SELECT
          (SELECT COUNT(*)::int FROM room_units WHERE room_type_id = $1) AS units,
          (
            SELECT COUNT(*)::int FROM bookings b
            WHERE (b.building_id = $2 OR lower(COALESCE(b.building_code, '')) = lower($3))
              AND lower(COALESCE(b.room_number, '')) IN (
                SELECT lower(value)
                FROM jsonb_array_elements_text($4::jsonb) AS item(value)
                UNION SELECT lower($5)
              )
          ) AS bookings
      `,
      [
        room.id,
        room.buildingId,
        room.buildingCode,
        JSON.stringify(room.specificRooms || []),
        String(room.roomNumber || ''),
      ],
    );
    const counts = dependencies.rows[0] || { units: 0, bookings: 0 };
    if (Number(counts.units) > 0 || Number(counts.bookings) > 0) {
      throw new HttpException(
        { error: 'Loại phòng đã có căn hoặc lịch xem. Hãy lưu trữ thay vì xóa vĩnh viễn.' },
        HttpStatus.CONFLICT,
      );
    }

    await this.db.query('DELETE FROM rooms WHERE id = $1', [room.id]);
    await this.buildings.updateDerivedStats(room.buildingId);
    await this.audit.create({
      user,
      action: 'DELETE',
      entityType: 'room_type',
      entityId: room.id,
      summary: `${user?.name || 'Admin'} đã xóa loại phòng ${room.type}`,
    }).catch(() => undefined);
    return { success: true, id: room.id };
  }

  private async lifecycleChange(id: string, lifecycleStatus: 'active' | 'archived', user: any) {
    const room = await this.requireManageRoom(id, user);
    const result = await this.db.query(
      `
        UPDATE rooms
        SET lifecycle_status = $2,
            status = CASE
              WHEN $2 = 'archived' THEN 'archived'
              WHEN EXISTS (
                SELECT 1 FROM room_units u
                WHERE u.room_type_id = rooms.id AND u.status = 'available'
              ) THEN 'Có sẵn'
              ELSE 'Hết phòng'
            END,
            deleted_at = CASE WHEN $2 = 'active' THEN NULL ELSE deleted_at END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [room.id, lifecycleStatus],
    );

    await this.buildings.updateDerivedStats(room.buildingId);
    const saved = await this.rawDetail(room.id);
    await this.audit.create({
      user,
      action: lifecycleStatus === 'archived' ? 'ARCHIVE' : 'RESTORE',
      entityType: 'room_type',
      entityId: room.id,
      summary: `${user?.name || 'Admin'} đã ${lifecycleStatus === 'archived' ? 'lưu trữ' : 'khôi phục'} loại phòng ${room.type}`,
    }).catch(() => undefined);
    return saved || mapRoomRow(result.rows[0]);
  }

  archive(id: string, user: any) {
    return this.lifecycleChange(id, 'archived', user);
  }

  restore(id: string, user: any) {
    return this.lifecycleChange(id, 'active', user);
  }
}
