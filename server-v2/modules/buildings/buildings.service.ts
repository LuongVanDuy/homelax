import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import {
  DEFAULT_SCHOOL_RADIUS_KM,
  decodeMapPolygon,
  buildingListQuerySchema, publicBuildingMapItemSchema, publicBuildingMapResultSchema, PUBLIC_BUILDING_MAP_LIMIT,
  type PublicBuildingMapQuery,
  type BuildingListQuery,
} from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import {
  canAccessBuilding,
  isPrivilegedBuildingRole,
  mapBuildingRow,
  mapRoomRow,
} from '../../database/row-mappers.js';
import { AuditService } from '../audit/audit.service.js';
import { AmenitiesService } from '../amenities/amenities.service.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { inventoryReadScope, publicAddressSql, publicApproximateMapPointSql, toPublicBuilding, toPublicRoom, withPublicAmenities } from '../../common/public-inventory.js';
import { PUBLIC_INVENTORY_CTE, schoolDistanceSql, publicAmenitiesSql, originDistanceSql } from '../../common/public-inventory-query.js';

function activeRoom(room: Record<string, any>) {
  return room.lifecycleStatus !== 'archived' && !room.deletedAt;
}

function csvValues(value: string) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function mapBuildingListRow(row: Record<string, any>) {
  return {
    ...mapBuildingRow(row),
    originDistanceKm: row.origin_distance_km == null ? null : Number(row.origin_distance_km),
    nearestSchoolId: row.nearest_school_id ? String(row.nearest_school_id) : null,
    nearestSchoolName: row.nearest_school_name ? String(row.nearest_school_name) : null,
    nearestSchoolCampus: row.nearest_school_campus ? String(row.nearest_school_campus) : null,
    nearestSchoolDistanceKm: row.nearest_school_distance_km === null || row.nearest_school_distance_km === undefined
      ? null
      : Number(row.nearest_school_distance_km),
    nearestSchoolEffectiveRadiusKm: row.nearest_school_effective_radius_km === null || row.nearest_school_effective_radius_km === undefined
      ? null
      : Number(row.nearest_school_effective_radius_km),
    nearestSchoolRadiusSource: row.nearest_school_radius_source === 'school'
      ? 'school' as const
      : row.nearest_school_radius_source === 'default'
        ? 'default' as const
        : null,
  };
}

function syncBuilding(
  building: Record<string, any>,
  rooms: Record<string, any>[],
) {
  const bId = String(building.id || '').trim().toLowerCase();
  const bCode = String(building.code || '').trim().toLowerCase();
  const bName = String(building.name || '').trim().toLowerCase();

  const allChildRooms = rooms.filter((room) => {
    const rId = String(room.buildingId || '').trim().toLowerCase();
    const rCode = String(room.buildingCode || '').trim().toLowerCase();
    const rName = String(room.buildingName || '').trim().toLowerCase();

    return (
      (bId && (rId === bId || rCode === bId)) ||
      (bCode && (rCode === bCode || rId === bCode)) ||
      (bName && rName === bName)
    );
  });
  const childRooms = allChildRooms.filter(activeRoom);

  const prices = childRooms
    .map((room) => Number(room.price) || 0)
    .filter((price) => price > 0);

  const vacantRoomsCount = allChildRooms.reduce(
    (sum, room) => sum + Number(room.vacantCount || 0),
    0,
  );
  const totalRoomsCount = allChildRooms.reduce(
    (sum, room) => sum + Number(room.totalUnits || 0),
    0,
  );

  return {
    ...building,
    minPrice:
      prices.length > 0
        ? Math.min(...prices)
        : Number(building.minPrice || 0),
    maxPrice:
      prices.length > 0
        ? Math.max(...prices)
        : Number(building.maxPrice || 0),
    vacantRoomsCount,
    totalRoomsCount,
    rooms: childRooms,
  };
}

@Injectable()
export class BuildingsService {
  constructor(
    private readonly db: PostgresService,
    private readonly audit: AuditService,
    private readonly amenities: AmenitiesService,
  ) {}

  assertCmsReadAccess(
    user: { allowedScreens?: unknown } | null | undefined,
    scope = 'public',
  ) {
    const isCmsScope = inventoryReadScope(scope) === 'cms';
    const screens = Array.isArray(user?.allowedScreens)
      ? user.allowedScreens
      : [];

    // These CMS screens share building/room data; mutations keep their own gates.
    if (
      isCmsScope &&
      !screens.some((screen) =>
        ['*', 'dashboard', 'buildings', 'rooms'].includes(screen),
      )
    ) {
      throw new ForbiddenException({
        error: 'Tài khoản không có quyền xem dữ liệu tòa nhà và phòng trong CMS.',
      });
    }

    return isCmsScope;
  }

  private async rows() {
    const result = await this.db.query(
      `
        SELECT b.*,
          COALESCE((
            SELECT jsonb_agg(ba.amenity_id ORDER BY a.sort_order, lower(a.name))
            FROM building_amenities ba JOIN amenities a ON a.id = ba.amenity_id
            WHERE ba.building_id = b.id
          ), '[]'::jsonb) AS amenity_ids
        FROM buildings b
        ORDER BY b.created_at DESC
      `,
    );

    return result.rows.map(mapBuildingRow);
  }

  private async rooms() {
    const result = await this.db.query(
      `
        SELECT
          r.*,
          COALESCE(inventory.room_units, '[]'::jsonb) AS room_units,
          COALESCE(inventory.total_units, 0)::int AS total_units,
          COALESCE(inventory.vacant_units, 0)::int AS vacant_units,
          inventory.next_available_from
        FROM rooms r
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(jsonb_agg(to_jsonb(u) ORDER BY lower(u.code)), '[]'::jsonb) AS room_units,
            count(*) FILTER (WHERE u.status <> 'archived')::int AS total_units,
            count(*) FILTER (WHERE u.status = 'available')::int AS vacant_units,
            min(u.available_from) FILTER (
              WHERE u.status IN ('occupied', 'maintenance')
                AND u.available_from IS NOT NULL
            ) AS next_available_from
          FROM room_units u
          WHERE u.room_type_id = r.id
        ) inventory ON TRUE
        ORDER BY r.created_at DESC
      `,
    );

    return result.rows.map(mapRoomRow);
  }

  private searchSql(user: any, query: BuildingListQuery) {
    const isCmsScope = this.assertCmsReadAccess(user, query.scope);
    const requireAccess = Boolean(
      isCmsScope && user && !isPrivilegedBuildingRole(user.roleCode),
    );
    const search = query.search.trim();
    const pattern = escapedLike(search);
    const schoolIds = csvValues(query.schoolIds);
    const amenityIds = csvValues(query.amenityIds);
    const anySchool = query.nearSchool === 'any' && schoolIds.length === 0;
    const hasSchoolFilter = schoolIds.length > 0 || anySchool;
    const region = query.mapSouth !== undefined && query.mapWest !== undefined
      && query.mapNorth !== undefined && query.mapEast !== undefined
      ? { south: query.mapSouth, west: query.mapWest, north: query.mapNorth, east: query.mapEast }
      : null;
    const publicMapSql = publicApproximateMapPointSql('b');
    const polygon = decodeMapPolygon(query.mapPolygon);
    const legacySortColumn = {
      updatedAt: 'b.updated_at',
      vacantRoomsCount: 'b.vacant_units_calc',
      minPrice: 'b.min_price_calc',
      code: 'lower(b.code)',
      name: 'lower(b.name)',
    } as const;
    const legacySort = query.sort in legacySortColumn
      ? legacySortColumn[query.sort as keyof typeof legacySortColumn]
      : null;
    const legacyOrder = query.order === 'asc' ? 'ASC' : 'DESC';
    const orderBy = query.sort === 'distance'
      ? 'b.origin_distance_km ASC NULLS LAST, b.vacant_units_calc DESC, b.updated_at DESC'
      : query.sort === 'nearest'
      ? 'b.nearest_school_distance_km ASC NULLS LAST, b.vacant_units_calc DESC, b.updated_at DESC'
      : query.sort === 'priceAsc'
        ? 'NULLIF(b.min_price_calc, 0) ASC NULLS LAST, b.updated_at DESC'
        : query.sort === 'priceDesc'
          ? 'NULLIF(b.max_price_calc, 0) DESC NULLS LAST, b.updated_at DESC'
          : query.sort === 'updated'
            ? 'b.updated_at DESC'
            : query.sort === 'smart'
              ? hasSchoolFilter
                ? 'b.nearest_school_distance_km ASC NULLS LAST, b.vacant_units_calc DESC, b.updated_at DESC'
                : 'b.vacant_units_calc DESC, b.updated_at DESC'
              : `${legacySort || 'b.updated_at'} ${legacyOrder}`;

    const searchableAddress = isCmsScope ? 'b.address' : publicAddressSql('b');
    const publicPredicate = isCmsScope ? '' : "AND b.deleted_at IS NULL";
    const hostSearch = isCmsScope
      ? "OR COALESCE(b.host_name, '') ILIKE $2 OR COALESCE(b.host_phone, '') ILIKE $2 OR COALESCE(b.host_email, '') ILIKE $2"
      : '';
    const dataCte = `
      WITH ${isCmsScope ? '' : `${PUBLIC_INVENTORY_CTE},`} room_stats AS (
        ${isCmsScope ? `
        SELECT
          r.building_id,
          MIN(r.price) FILTER (
            WHERE r.lifecycle_status = 'active'
              AND r.deleted_at IS NULL
              AND r.price > 0
          ) AS min_price_calc,
          MAX(r.price) FILTER (
            WHERE r.lifecycle_status = 'active'
              AND r.deleted_at IS NULL
              AND r.price > 0
          ) AS max_price_calc,
          COUNT(u.id) FILTER (
            WHERE r.lifecycle_status = 'active'
              AND r.deleted_at IS NULL
              AND u.status <> 'archived'
          )::int AS total_units,
          COUNT(u.id) FILTER (
            WHERE r.lifecycle_status = 'active'
              AND r.deleted_at IS NULL
              AND u.status = 'available'
          )::int AS vacant_units
        FROM rooms r
        LEFT JOIN room_units u ON u.room_type_id = r.id
        GROUP BY r.building_id
        ` : `SELECT building_id,
          MIN(price) FILTER (WHERE vacant_units > 0 AND price > 0) AS min_price_calc,
          MAX(price) FILTER (WHERE vacant_units > 0 AND price > 0) AS max_price_calc,
          SUM(total_units)::int AS total_units, SUM(vacant_units)::int AS vacant_units
          FROM public_inventory GROUP BY building_id`}
      ),
      building_base AS (
        SELECT
          b.*,
          ${isCmsScope ? '' : `${publicAmenitiesSql('building', 'b')} AS public_amenities,`}
          COALESCE(rs.vacant_units, 0)::int AS vacant_units_calc,
          COALESCE(rs.total_units, 0)::int AS total_rooms_count,
          COALESCE(rs.min_price_calc, ${isCmsScope ? 'b.min_price,' : ''} 0) AS min_price_calc,
          COALESCE(rs.max_price_calc, ${isCmsScope ? 'b.max_price,' : ''} 0) AS max_price_calc,
          COALESCE((
            SELECT jsonb_agg(ba.amenity_id ORDER BY a.sort_order, lower(a.name))
            FROM building_amenities ba
            JOIN amenities a ON a.id = ba.amenity_id
            WHERE ba.building_id = b.id
          ), '[]'::jsonb) AS amenity_ids
        FROM buildings b
        LEFT JOIN room_stats rs ON rs.building_id = b.id
      ),
      school_distances AS (
        SELECT
          bb.id AS building_id,
          s.id AS school_id,
          s.name AS school_name,
          s.campus AS school_campus,
          COALESCE(s.radius_km, $15::numeric) AS effective_radius_km,
          CASE WHEN s.radius_km IS NULL THEN 'default' ELSE 'school' END AS radius_source,
          ${schoolDistanceSql('bb')} AS distance_km
        FROM building_base bb
        JOIN schools s ON (${anySchool ? 'TRUE' : 'FALSE'} OR s.id = ANY($16::text[]))
        WHERE (${anySchool ? 'TRUE' : 'FALSE'} OR $16::text[] <> '{}'::text[])
          AND s.status = 'active'
          AND s.latitude IS NOT NULL
          AND s.longitude IS NOT NULL
          AND bb.latitude IS NOT NULL
          AND bb.longitude IS NOT NULL
      ),
      school_matches AS (
        SELECT *
        FROM school_distances
        WHERE distance_km <= effective_radius_km
      ),
      nearest_school AS (
        SELECT DISTINCT ON (building_id)
          building_id,
          school_id,
          school_name,
          school_campus,
          effective_radius_km,
          radius_source,
          distance_km
        FROM school_matches
        ORDER BY building_id, distance_km ASC, school_id ASC
      ),
      building_data AS (
        SELECT
          bb.*,
          ${originDistanceSql('bb', 25, 26)} AS origin_distance_km,
          ns.school_id AS nearest_school_id,
          ns.school_name AS nearest_school_name,
          ns.school_campus AS nearest_school_campus,
          ns.distance_km AS nearest_school_distance_km,
          ns.effective_radius_km AS nearest_school_effective_radius_km,
          ns.radius_source AS nearest_school_radius_source
        FROM building_base bb
        LEFT JOIN nearest_school ns ON ns.building_id = bb.id
      )
    `;
    const effectiveStatus = isCmsScope ? query.status : 'active';
    const ward = query.ward.trim();
    const universityWard = query.universityWard.trim();
    const wardName = ward;
    const universityPattern = escapedLike(universityWard);
    const roomTypeIds = csvValues(query.roomTypeIds);
    const roomTypes = roomTypeIds.length ? roomTypeIds : csvValues(query.roomTypes);
    const where = `
      WHERE ($1 = '' OR b.name ILIKE $2 OR b.code ILIKE $2 OR ${searchableAddress} ILIKE $2
        OR b.district ILIKE $2 OR COALESCE(b.ward, '') ILIKE $2 OR b.city ILIKE $2
        ${hostSearch})
        ${publicPredicate}
        AND ($3 = '' OR b.status = $3)
        ${!isCmsScope && query.availability === 'available' ? 'AND b.vacant_units_calc > 0' : ''}
        AND ($4 = '' OR b.owner_type = $4)
        AND ($25::double precision IS NULL OR (b.origin_distance_km IS NOT NULL
          AND ($27::double precision IS NULL OR b.origin_distance_km <= $27::double precision)))
        AND (
          $5 = ''
          OR ($5 = 'located' AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL)
          OR ($5 = 'missing' AND (b.latitude IS NULL OR b.longitude IS NULL))
        )
        AND (
          $6::boolean = FALSE
          OR b.owner_id = $7
          OR b.created_by = $7
          OR COALESCE(b.allowed_viewer_ids, '[]'::jsonb) ? $7
        )
        AND (
          $8 = ''
          OR LOWER(BTRIM(COALESCE(b.ward, ''))) = LOWER(BTRIM($9))
        )
        AND (
          $10 = ''
          OR COALESCE(b.ward, '') ILIKE $11
          OR COALESCE(b.district, '') ILIKE $11
          OR ${searchableAddress} ILIKE $11
        )
        AND (
          $12::numeric = 0
          OR COALESCE(NULLIF(b.max_price_calc, 0), b.min_price_calc, 0) >= $12::numeric
        )
        AND (
          $13::numeric = 0
          OR COALESCE(b.min_price_calc, 0) <= $13::numeric
        )
        AND (
          ($14::text[] = '{}'::text[] AND $24 = '')
          OR EXISTS (
            SELECT 1
            FROM rooms sr
            JOIN room_type_catalog rtc ON rtc.id = sr.room_type_catalog_id
            WHERE sr.building_id = b.id
              AND sr.lifecycle_status = 'active'
              AND sr.deleted_at IS NULL
              AND rtc.status = 'active'
              AND (
                $14::text[] = '{}'::text[] OR sr.room_type_catalog_id = ANY($14::text[])
                OR lower(rtc.name) = ANY(ARRAY(
                  SELECT lower(requested) FROM unnest($14::text[]) AS requested
                ))
              )
              AND ($24 = '' OR sr.audience_groups ? $24)
          )
        )
        AND (${hasSchoolFilter ? 'b.nearest_school_id IS NOT NULL' : 'TRUE'})
        AND (
          $17::text[] = '{}'::text[]
          OR NOT EXISTS (
            SELECT 1
            FROM unnest($17::text[]) AS requested(amenity_id)
            WHERE NOT (
              EXISTS (
                SELECT 1
                FROM building_amenities ba
                WHERE ba.building_id = b.id
                  AND ba.amenity_id = requested.amenity_id
                  ${isCmsScope ? '' : "AND EXISTS (SELECT 1 FROM amenities a WHERE a.id = ba.amenity_id AND a.status = 'active' AND a.scope = 'building')"}
              )
              OR EXISTS (
                SELECT 1
                FROM rooms ar
                JOIN room_type_amenities rta ON rta.room_type_id = ar.id
                WHERE ar.building_id = b.id
                  AND ar.lifecycle_status = 'active'
                  AND ar.deleted_at IS NULL
                  AND rta.amenity_id = requested.amenity_id
                  ${isCmsScope ? '' : "AND EXISTS (SELECT 1 FROM amenities a WHERE a.id = rta.amenity_id AND a.status = 'active' AND a.scope = 'room')"}
              )
            )
          )
        )
        AND (
          $18::boolean = FALSE
          OR (
            b.latitude IS NOT NULL
            AND b.longitude IS NOT NULL
            AND ${publicMapSql.lat} >= $19::numeric
            AND ${publicMapSql.lat} <= $21::numeric
            AND ${publicMapSql.lng} >= $20::numeric
            AND ${publicMapSql.lng} <= $22::numeric
            AND ($23::polygon IS NULL OR $23::polygon @> point((${publicMapSql.lng})::double precision * 1000000, (${publicMapSql.lat})::double precision * 1000000))
          )
        )
    `;
    const params = [
      search,
      pattern,
      effectiveStatus,
      query.ownerType,
      query.location,
      requireAccess,
      String(user?.id || ''),
      ward,
      wardName,
      universityWard,
      universityPattern,
      query.minPrice,
      query.maxPrice,
      roomTypes,
      DEFAULT_SCHOOL_RADIUS_KM,
      schoolIds,
      amenityIds,
      Boolean(region),
      region?.south ?? 0,
      region?.west ?? 0,
      region?.north ?? 0,
      region?.east ?? 0,
      // Scale degrees equally on both axes: PostgreSQL geometric epsilon is too
      // coarse for cross-products of short edges expressed in decimal degrees.
      polygon ? `(${polygon.map(([lat, lng]) => `(${lng * 1000000},${lat * 1000000})`).join(',')})` : null,
      query.audience,
      query.originLat ?? null, query.originLng ?? null, query.radiusKm ?? null,
    ];
    return { dataCte, where, params, orderBy, isCmsScope };
  }

  async list(user: any, query: BuildingListQuery) {
    const { dataCte, where, params, orderBy, isCmsScope } = this.searchSql(user, query);
    const [rows, count] = await Promise.all([
      this.db.query(
        `${dataCte}
         SELECT * FROM building_data b
         ${where}
         ORDER BY ${orderBy}, b.id DESC
         LIMIT $28 OFFSET $29`,
        [...params, query.pageSize, pageOffset(query.page, query.pageSize)],
      ),
      this.db.query<{ count: number }>(
        `${dataCte}
         SELECT COUNT(*)::int AS count FROM building_data b ${where}`,
        params,
      ),
    ]);

    return pageResult(
      rows.rows.map((row) => {
        const building = mapBuildingListRow(row);
        return isCmsScope ? building : toPublicBuilding(withPublicAmenities(building, row.public_amenities));
      }),
      query.page,
      query.pageSize,
      Number(count.rows[0]?.count || 0),
    );
  }

  async publicMap(query: PublicBuildingMapQuery) {
    // Both consumers share the exact membership SQL, including lifecycle, school,
    // amenities, inventory and privacy-preserving region predicates.
    const { dataCte, where, params } = this.searchSql(null,
      buildingListQuerySchema.parse({ ...query, scope: 'public', status: 'active' }));
    const located = 'b.latitude IS NOT NULL AND b.longitude IS NOT NULL';
    // Counts and marker rows are read from one PostgreSQL statement/snapshot.
    const result = await this.db.query(
      `${dataCte}, matching AS MATERIALIZED (SELECT * FROM building_data b ${where})
       SELECT (SELECT COUNT(*)::int FROM matching) AS total,
         (SELECT COUNT(*)::int FROM matching b WHERE ${located}) AS mappable_total,
         (SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM (
           SELECT id, code, name, status, owner_type, address, district, ward, city,
             latitude, longitude, host_name, host_phone, host_email, host_address,
             cover_image, images, vacant_units_calc, total_rooms_count, min_price_calc, max_price_calc
           FROM matching b WHERE ${located}
           ORDER BY b.id LIMIT ${PUBLIC_BUILDING_MAP_LIMIT}
         ) m) AS marker_rows`, params,
    );
    const row = result.rows[0];
    const total = Number(row?.total || 0);
    const mappableTotal = Number(row?.mappable_total || 0);
    const markers = (row?.marker_rows || []).map((raw: Record<string, unknown>) => {
      const b = toPublicBuilding(mapBuildingListRow(raw));
      return publicBuildingMapItemSchema.parse({
        id: b.id, code: b.code, name: b.name, ownerType: b.ownerType,
        address: b.address, district: b.district, ward: b.ward, city: b.city,
        coverImage: b.coverImage || b.images[0] || '', minPrice: b.minPrice,
        priceState: b.priceState, vacantRoomsCount: b.vacantRoomsCount, mapPoint: b.mapPoint,
      });
    });
    return publicBuildingMapResultSchema.parse({
      total, mappableTotal, missingLocationTotal: total - mappableTotal,
      limit: PUBLIC_BUILDING_MAP_LIMIT, truncated: mappableTotal > PUBLIC_BUILDING_MAP_LIMIT, markers,
    });
  }

  async stats(user: any) {
    this.assertCmsReadAccess(user, 'cms');
    const requireAccess = Boolean(
      user && !isPrivilegedBuildingRole(user.roleCode),
    );
    const result = await this.db.query<{
      active: number;
      archived: number;
      partner: number;
      missing_coordinates: number;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status <> 'archived')::int AS active,
          COUNT(*) FILTER (WHERE status = 'archived')::int AS archived,
          COUNT(*) FILTER (WHERE status <> 'archived' AND owner_type = 'partner')::int AS partner,
          COUNT(*) FILTER (
            WHERE status <> 'archived'
              AND (latitude IS NULL OR longitude IS NULL)
          )::int AS missing_coordinates
        FROM buildings b
        WHERE (
          $1::boolean = FALSE
          OR b.owner_id = $2
          OR b.created_by = $2
          OR COALESCE(b.allowed_viewer_ids, '[]'::jsonb) ? $2
        )
      `,
      [requireAccess, String(user?.id || '')],
    );
    const row = result.rows[0] || {
      active: 0,
      archived: 0,
      partner: 0,
      missing_coordinates: 0,
    };
    return {
      active: Number(row.active || 0),
      archived: Number(row.archived || 0),
      partner: Number(row.partner || 0),
      missingCoordinates: Number(row.missing_coordinates || 0),
    };
  }

  private async rawDetail(id: string, publicRead = false) {
    const result = await this.db.query(
      `
        SELECT b.*,
          ${publicRead ? `${publicAmenitiesSql('building', 'b')} AS public_amenities,` : ''}
          COALESCE((
            SELECT jsonb_agg(ba.amenity_id ORDER BY a.sort_order, lower(a.name))
            FROM building_amenities ba
            JOIN amenities a ON a.id = ba.amenity_id
            WHERE ba.building_id = b.id
          ), '[]'::jsonb) AS amenity_ids
        FROM buildings b
        WHERE (lower(b.id) = lower($1) OR lower(b.code) = lower($1))
          ${publicRead ? "AND b.deleted_at IS NULL AND b.status IN ('active', 'archived')" : ''}
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];
    if (!row) return null;
    const building = mapBuildingRow(row);
    return publicRead ? withPublicAmenities(building, row.public_amenities) : building;
  }

  async detail(id: string, user: any, scope = 'public') {
    const isCmsScope = this.assertCmsReadAccess(user, scope);
    const building = await this.rawDetail(id, !isCmsScope);

    if (!building) {
      throw new NotFoundException({
        error: 'Building not found',
      });
    }

    if (
      isCmsScope &&
      user &&
      !canAccessBuilding(building, user)
    ) {
      throw new ForbiddenException({
        error: 'Bạn không có quyền xem tòa nhà này.',
      });
    }

    const rooms = await this.db.query(
      `
        SELECT
          r.*,
          ${isCmsScope ? '' : `${publicAmenitiesSql('room', 'r')} AS public_amenities,`}
          COALESCE(inventory.room_units, '[]'::jsonb) AS room_units,
          COALESCE(inventory.total_units, 0)::int AS total_units,
          COALESCE(inventory.vacant_units, 0)::int AS vacant_units,
          inventory.next_available_from
        FROM rooms r
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(jsonb_agg(to_jsonb(u) ORDER BY lower(u.code)), '[]'::jsonb) AS room_units,
            count(*) FILTER (WHERE u.status <> 'archived')::int AS total_units,
            count(*) FILTER (WHERE u.status = 'available')::int AS vacant_units,
            min(u.available_from) FILTER (
              WHERE u.status IN ('occupied', 'maintenance')
                AND u.available_from IS NOT NULL
            ) AS next_available_from
          FROM room_units u
          WHERE u.room_type_id = r.id
        ) inventory ON TRUE
        WHERE (r.building_id = $1 ${isCmsScope ? 'OR lower(r.building_code) = lower($2)' : "AND $2::text IS NOT NULL"})
          ${isCmsScope ? '' : "AND r.lifecycle_status = 'active' AND r.deleted_at IS NULL"}
        ORDER BY r.created_at DESC
      `,
      [building.id, building.code],
    );

    if (!isCmsScope) {
      const childRooms = building.status === 'active'
        ? rooms.rows.map((row) => toPublicRoom(withPublicAmenities(mapRoomRow(row), row.public_amenities), building))
        : [];
      const current = childRooms.filter((room) => room.vacantCount > 0);
      const prices = current.map((room) => room.price).filter((price) => price > 0);
      return {
        ...toPublicBuilding({
          ...building,
          vacantRoomsCount: childRooms.reduce((sum, room) => sum + room.vacantCount, 0),
          totalRoomsCount: childRooms.reduce((sum, room) => sum + room.totalUnits, 0),
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
        }),
        rooms: current,
      };
    }
    return syncBuilding(building, rooms.rows.map(mapRoomRow));
  }

  async save(
    data: Record<string, any>,
    user: any,
  ) {
    if (!data.name && !data.code) {
      throw new HttpException(
        {
          error: 'Tên tòa nhà hoặc Mã tòa nhà không được để trống.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const lookup = String(data.id || data.code || '').trim();
    const existing = lookup
      ? await this.rawDetail(lookup)
      : null;

    if (
      existing &&
      user &&
      !canAccessBuilding(existing, user)
    ) {
      throw new ForbiddenException({
        error: 'Bạn không có quyền chỉnh sửa tòa nhà này.',
      });
    }

    const requestedCode = String(data.code || '').trim().toUpperCase();
    const cleanCode = existing?.code || requestedCode || `BLD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const cleanName = String(data.name || existing?.name || '').trim();
    const cleanAddress = String(data.address ?? existing?.address ?? '').trim();
    const hostName = String(data.hostName ?? existing?.hostName ?? '').trim();
    const hostPhone = String(data.hostPhone ?? existing?.hostPhone ?? '').trim();
    const hostEmail = String(data.hostEmail ?? existing?.hostEmail ?? '').trim();
    const hostAddress = String(data.hostAddress ?? existing?.hostAddress ?? '').trim();

    if (!cleanName || !cleanAddress || !hostName || !hostPhone || !hostAddress) {
      throw new HttpException(
        {
          error: 'Vui lòng nhập đủ tên tòa, địa chỉ và thông tin chủ nhà/người quản lý.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const duplicate = await this.db.query<{
      id: string;
      code: string;
      name: string;
    }>(
      `
        SELECT id, code, name
        FROM buildings
        WHERE (
          lower(code) = lower($1)
          OR lower(name) = lower($2)
        )
          AND id <> $3
        LIMIT 1
      `,
      [
        cleanCode,
        cleanName,
        String(existing?.id || data.id || ''),
      ],
    );

    if (duplicate.rows[0]) {
      throw new HttpException(
        {
          error:
            String(duplicate.rows[0].code).toLowerCase() ===
            cleanCode.toLowerCase()
              ? `Mã tòa nhà "${cleanCode}" đã tồn tại.`
              : `Tên tòa nhà "${cleanName}" đã tồn tại.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    const privileged = isPrivilegedBuildingRole(
      user?.roleCode || '',
    );

    const id =
      existing?.id ||
      String(data.id || `BLD-${Date.now()}-${crypto.randomInt(100, 999)}`);

    const ownerType =
      data.ownerType ||
      existing?.ownerType ||
      (data.isTiny ? 'tiny' : 'partner');

    const ownerId =
      existing?.ownerId ||
      (!privileged ? user?.id || '' : '');

    const createdBy =
      existing?.createdBy ||
      user?.id ||
      '';

    const allowedViewerIds = existing?.allowedViewerIds || [];

    const result = await this.db.query(
      `
        INSERT INTO buildings (
          id, code, name, is_tiny, owner_type,
          owner_id, created_by, allowed_viewer_ids,
          status, deleted_at, rating,
          address, district, ward, city, province,
          latitude, longitude,
          vacant_rooms_count, min_price, max_price,
          cover_image, images, media_360, rooms,
          host_name, host_phone, host_email,
          amenities_pccc, amenities_building,
          amenities_building_chung,
          amenities_building_an_ninh,
          amenities_building_pccc,
          amenities_building_thoat_nan,
          host_address,
          updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,
          $9,$10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23::jsonb,$24::jsonb,$25::jsonb,
          $26,$27,$28,$29::jsonb,$30::jsonb,
          $31::jsonb,$32::jsonb,$33::jsonb,$34::jsonb,
          $35,NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          is_tiny = EXCLUDED.is_tiny,
          owner_type = EXCLUDED.owner_type,
          owner_id = EXCLUDED.owner_id,
          created_by = EXCLUDED.created_by,
          allowed_viewer_ids = EXCLUDED.allowed_viewer_ids,
          status = EXCLUDED.status,
          deleted_at = EXCLUDED.deleted_at,
          rating = EXCLUDED.rating,
          address = EXCLUDED.address,
          district = EXCLUDED.district,
          ward = EXCLUDED.ward,
          city = EXCLUDED.city,
          province = EXCLUDED.province,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          vacant_rooms_count = EXCLUDED.vacant_rooms_count,
          min_price = EXCLUDED.min_price,
          max_price = EXCLUDED.max_price,
          cover_image = EXCLUDED.cover_image,
          images = EXCLUDED.images,
          media_360 = EXCLUDED.media_360,
          rooms = EXCLUDED.rooms,
          host_name = EXCLUDED.host_name,
          host_phone = EXCLUDED.host_phone,
          host_email = EXCLUDED.host_email,
          amenities_pccc = EXCLUDED.amenities_pccc,
          amenities_building = EXCLUDED.amenities_building,
          amenities_building_chung = EXCLUDED.amenities_building_chung,
          amenities_building_an_ninh = EXCLUDED.amenities_building_an_ninh,
          amenities_building_pccc = EXCLUDED.amenities_building_pccc,
          amenities_building_thoat_nan = EXCLUDED.amenities_building_thoat_nan,
          host_address = EXCLUDED.host_address,
          updated_at = NOW()
        RETURNING *
      `,
      [
        id,
        cleanCode,
        cleanName,
        ownerType === 'tiny',
        ownerType,
        ownerId,
        createdBy,
        JSON.stringify(allowedViewerIds),
        existing?.status || 'active',
        existing?.deletedAt || null,
        Number(existing?.rating ?? 0),
        cleanAddress,
        data.district ?? existing?.district ?? '',
        data.ward ?? existing?.ward ?? '',
        data.city ?? existing?.city ?? 'Hà Nội',
        data.province ??
          existing?.province ??
          data.city ??
          existing?.city ??
          'Hà Nội',
        data.latitude === undefined
          ? existing?.latitude ?? null
          : Number(data.latitude),
        data.longitude === undefined
          ? existing?.longitude ?? null
          : Number(data.longitude),
        Number(existing?.vacantRoomsCount ?? 0),
        Number(existing?.minPrice ?? 0),
        Number(existing?.maxPrice ?? 0),
        data.coverImage ?? existing?.coverImage ?? '',
        JSON.stringify(data.images ?? existing?.images ?? []),
        JSON.stringify(data.media360 ?? existing?.media360 ?? []),
        JSON.stringify(existing?.rooms ?? []),
        hostName,
        hostPhone,
        hostEmail,
        JSON.stringify(existing?.amenitiesPccc ?? []),
        JSON.stringify(existing?.amenitiesBuilding ?? []),
        JSON.stringify(existing?.amenitiesBuildingChung ?? []),
        JSON.stringify(existing?.amenitiesBuildingAnNinh ?? []),
        JSON.stringify(existing?.amenitiesBuildingPccc ?? []),
        JSON.stringify(existing?.amenitiesBuildingThoatNan ?? []),
        hostAddress,
      ],
    );

    const saved = mapBuildingRow(result.rows[0]);
    if (Array.isArray(data.amenityIds)) {
      await this.amenities.syncBuildingAssignments(saved.id, data.amenityIds);
    }

    await this.audit
      .create({
        user,
        action: existing ? 'UPDATE' : 'CREATE',
        entityType: 'building',
        entityId: saved.id,
        summary: `${user?.name || 'Admin'} đã ${existing ? 'cập nhật' : 'tạo'} tòa nhà ${saved.code || saved.name}`,
      })
      .catch(() => undefined);

    return this.detail(saved.id, user, 'cms');
  }

  async remove(id: string, user: any) {
    if (
      !['admin', 'superadmin'].includes(
        String(user?.roleCode || '').toLowerCase(),
      )
    ) {
      throw new ForbiddenException({
        error: 'Chỉ quản trị viên mới được xóa vĩnh viễn tòa nhà.',
      });
    }

    const existing = await this.rawDetail(id);

    if (!existing) {
      throw new NotFoundException({
        error: 'Tòa nhà không tồn tại.',
      });
    }

    const dependencies = await this.db.query<{ rooms: number; bookings: number }>(
      `
        SELECT
          (SELECT COUNT(*)::int FROM rooms
           WHERE building_id = $1 OR lower(COALESCE(building_code, '')) = lower($2)) AS rooms,
          (SELECT COUNT(*)::int FROM bookings
           WHERE building_id = $1 OR lower(COALESCE(building_code, '')) = lower($2)) AS bookings
      `,
      [existing.id, existing.code],
    );
    const counts = dependencies.rows[0] || { rooms: 0, bookings: 0 };
    if (Number(counts.rooms) > 0 || Number(counts.bookings) > 0) {
      throw new HttpException(
        {
          error: 'Tòa nhà đã có phòng hoặc lịch xem. Hãy lưu trữ thay vì xóa vĩnh viễn.',
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.db.query(
      `
        DELETE FROM buildings
        WHERE id = $1 OR code = $2
      `,
      [existing.id, existing.code],
    );

    await this.audit
      .create({
        user,
        action: 'DELETE',
        entityType: 'building',
        entityId: existing.id,
        summary: `${user?.name || 'Admin'} đã xóa tòa nhà ${existing.code}`,
      })
      .catch(() => undefined);

    return {
      success: true,
      id: existing.id,
    };
  }

  private async statusChange(
    id: string,
    status: 'active' | 'archived',
    user: any,
  ) {
    const existing = await this.rawDetail(id);

    if (!existing) {
      throw new NotFoundException({
        error: 'Tòa nhà không tồn tại.',
      });
    }

    if (!canAccessBuilding(existing, user)) {
      throw new ForbiddenException({
        error: 'Bạn không có quyền thay đổi trạng thái tòa nhà này.',
      });
    }

    const result = await this.db.query(
      `
        UPDATE buildings
        SET status = $2,
            deleted_at = CASE
              WHEN $2 = 'active' THEN NULL
              ELSE deleted_at
            END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [existing.id, status],
    );

    const saved = mapBuildingRow(result.rows[0]);
    await this.audit.create({
      user,
      action: status === 'archived' ? 'ARCHIVE' : 'RESTORE',
      entityType: 'building',
      entityId: saved.id,
      summary: `${user?.name || 'Admin'} đã ${status === 'archived' ? 'lưu trữ' : 'khôi phục'} tòa nhà ${saved.code || saved.name}`,
    }).catch(() => undefined);

    return saved;
  }

  archive(id: string, user: any) {
    return this.statusChange(id, 'archived', user);
  }

  restore(id: string, user: any) {
    return this.statusChange(id, 'active', user);
  }

  async updateViewPermissions(
    id: string,
    viewerIds: Array<string | number>,
    user: any,
  ) {
    if (!isPrivilegedBuildingRole(user?.roleCode || '')) {
      throw new ForbiddenException({
        error: 'Bạn không có quyền phân quyền tòa nhà.',
      });
    }

    const existing = await this.rawDetail(id);

    if (!existing) {
      throw new NotFoundException({
        error: 'Tòa nhà không tồn tại.',
      });
    }

    const result = await this.db.query(
      `
        UPDATE buildings
        SET allowed_viewer_ids = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        existing.id,
        JSON.stringify(
          Array.from(
            new Set(
              viewerIds
                .map(String)
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ),
        ),
      ],
    );

    return mapBuildingRow(result.rows[0]);
  }

  async updateDerivedStats(buildingIdOrCode: string) {
    const existing = await this.rawDetail(buildingIdOrCode);
    if (!existing) return;

    const [roomTypes, inventory] = await Promise.all([
      this.db.query(
        `
          SELECT price
          FROM rooms
          WHERE (
            building_id = $1
            OR lower(building_code) = lower($2)
          )
            AND lifecycle_status = 'active'
            AND deleted_at IS NULL
        `,
        [existing.id, existing.code],
      ),
      this.db.query<{
        vacant: number;
        total: number;
      }>(
        `
          SELECT
            count(*) FILTER (WHERE u.status = 'available')::int AS vacant,
            count(*) FILTER (WHERE u.status <> 'archived')::int AS total
          FROM room_units u
          JOIN rooms r ON r.id = u.room_type_id
          WHERE u.building_id = $1
            AND r.lifecycle_status = 'active'
        `,
        [existing.id],
      ),
    ]);

    const prices = roomTypes.rows
      .map((row) => Number(row.price || 0))
      .filter((price) => price > 0);
    const vacant = Number(inventory.rows[0]?.vacant || 0);

    await this.db.query(
      `
        UPDATE buildings
        SET vacant_rooms_count = $2,
            min_price = $3,
            max_price = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        existing.id,
        vacant,
        prices.length ? Math.min(...prices) : 0,
        prices.length ? Math.max(...prices) : 0,
      ],
    );
  }
}
