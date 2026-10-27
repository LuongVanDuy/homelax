import {
  DEFAULT_SCHOOL_RADIUS_KM, publicRoomSearchItemSchema, decodeMapPolygon,
  type PublicRoomSearchQuery,
} from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import { mapBuildingRow, mapRoomRow } from '../../database/row-mappers.js';
import { escapedLike, pageOffset, pageResult } from '../../common/list/list-utils.js';
import { publicAddressSql, publicApproximateMapPointSql, toPublicBuilding, toPublicRoom, withPublicAmenities } from '../../common/public-inventory.js';
import { csvValues, PUBLIC_INVENTORY_CTE, schoolDistanceSql, publicAmenitiesSql, originDistanceSql } from '../../common/public-inventory-query.js';

export async function searchPublicRooms(db: PostgresService, query: PublicRoomSearchQuery) {
  const schools = csvValues(query.schoolIds);
  const anySchool = query.nearSchool === 'any' && schools.length === 0;
  const polygon = decodeMapPolygon(query.mapPolygon);
  const mapPoint = publicApproximateMapPointSql('b');
  const order = query.order === 'asc' ? 'ASC' : 'DESC';
  const distanceSort = 'f.distance_km ASC NULLS LAST, f.vacant_units DESC, f.updated_at DESC';
  const orderBy = {
    smart: schools.length || anySchool ? distanceSort : 'f.vacant_units DESC, f.updated_at DESC',
    nearest: distanceSort,
    distance: 'f.origin_distance_km ASC NULLS LAST, f.vacant_units DESC, f.updated_at DESC',
    priceAsc: 'CASE WHEN f.price > 0 THEN f.price END ASC NULLS LAST, f.updated_at DESC',
    priceDesc: 'CASE WHEN f.price > 0 THEN f.price END DESC NULLS LAST, f.updated_at DESC',
    updated: 'f.updated_at DESC',
    type: `lower(f.type) ${order}`,
    vacantCount: `f.vacant_units ${order}, f.updated_at DESC`,
  }[query.sort];
  const params = [
    query.search, escapedLike(query.search), query.building, query.ownerType,
    query.ward, query.ward, (csvValues(query.roomTypeIds).length ? csvValues(query.roomTypeIds) : csvValues(query.roomTypes)),
    schools, csvValues(query.amenityIds), query.minPrice, query.maxPrice,
    query.availability, DEFAULT_SCHOOL_RADIUS_KM,
    query.audience, anySchool, query.mapSouth !== undefined,
    query.mapSouth ?? 0, query.mapWest ?? 0, query.mapNorth ?? 0, query.mapEast ?? 0,
    polygon ? `(${polygon.map(([lat, lng]) => `(${lng * 1000000},${lat * 1000000})`).join(',')})` : null,
    query.originLat ?? null, query.originLng ?? null, query.radiusKm ?? null,
  ];
  const cte = `WITH ${PUBLIC_INVENTORY_CTE}, filtered AS (
    SELECT pi.*, r.type, r.room_type_catalog_id, rtc.name AS room_type_catalog_name, rtc.status AS room_type_catalog_status, r.updated_at,
      ${originDistanceSql('b', 22, 23)} AS origin_distance_km,
      nearest.school_id, nearest.school_name, nearest.campus,
      nearest.distance_km, nearest.effective_radius_km, nearest.radius_source
    FROM public_inventory pi
    JOIN rooms r ON r.id = pi.id
    JOIN room_type_catalog rtc ON rtc.id = r.room_type_catalog_id
    JOIN buildings b ON b.id = pi.building_id
    LEFT JOIN LATERAL (
      SELECT s.id AS school_id, s.name AS school_name, s.campus,
        ${schoolDistanceSql('b')} AS distance_km,
        COALESCE(s.radius_km, $13::numeric) AS effective_radius_km,
        CASE WHEN s.radius_km IS NULL THEN 'default' ELSE 'school' END AS radius_source
      FROM schools s
      WHERE ($15::boolean OR s.id = ANY($8::text[])) AND s.status = 'active'
        AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
        AND ${schoolDistanceSql('b')} <= COALESCE(s.radius_km, $13::numeric)
      ORDER BY distance_km ASC, s.id ASC LIMIT 1
    ) nearest ON TRUE
    WHERE ($1 = '' OR r.type ILIKE $2 OR b.name ILIKE $2 OR b.code ILIKE $2
      OR ${publicAddressSql('b')} ILIKE $2)
      AND ($3 = '' OR b.id = $3 OR lower(b.code) = lower($3))
      AND ($4 = '' OR b.owner_type = $4)
      AND ($22::double precision IS NULL OR (b.latitude IS NOT NULL AND b.longitude IS NOT NULL
        AND ($24::double precision IS NULL OR ${originDistanceSql('b', 22, 23)} <= $24::double precision)))
      AND ($5 = '' OR LOWER(BTRIM(COALESCE(b.ward, ''))) = LOWER(BTRIM($6)))
      AND ($7::text[] = '{}'::text[] OR (rtc.status = 'active' AND (r.room_type_catalog_id = ANY($7::text[]) OR lower(rtc.name) = ANY(ARRAY(SELECT lower(requested) FROM unnest($7::text[]) AS requested)))))
      AND (($8::text[] = '{}'::text[] AND NOT $15::boolean) OR nearest.school_id IS NOT NULL)
      AND ($14 = '' OR (rtc.status = 'active' AND r.audience_groups ? $14))
      AND (NOT $16::boolean OR (
        b.latitude IS NOT NULL AND b.longitude IS NOT NULL
        AND ${mapPoint.lat} BETWEEN $17::numeric AND $19::numeric
        AND ${mapPoint.lng} BETWEEN $18::numeric AND $20::numeric
        AND ($21::polygon IS NULL OR $21::polygon @> point((${mapPoint.lng})::double precision * 1000000, (${mapPoint.lat})::double precision * 1000000))
      ))
      AND ($10::numeric = 0 OR r.price >= $10::numeric)
      AND ($11::numeric = 0 OR (r.price > 0 AND r.price <= $11::numeric))
      AND ($12 = '' OR ($12 = 'available' AND pi.vacant_units > 0)
        OR ($12 = 'full' AND pi.total_units > 0 AND pi.vacant_units = 0)
        OR ($12 = 'empty' AND pi.total_units = 0))
      AND NOT EXISTS (
        SELECT 1 FROM unnest($9::text[]) requested(id)
        WHERE NOT EXISTS (
          SELECT 1 FROM amenities a WHERE a.id = requested.id AND a.status = 'active'
            AND ((a.scope = 'building' AND EXISTS (
              SELECT 1 FROM building_amenities ba WHERE ba.building_id = b.id AND ba.amenity_id = a.id
            )) OR (a.scope = 'room' AND EXISTS (
              SELECT 1 FROM room_type_amenities ra WHERE ra.room_type_id = r.id AND ra.amenity_id = a.id
            )))
        )
      )
  )`;
  const [result, totals] = await Promise.all([
    db.query(`${cte}, selected AS (
      SELECT * FROM filtered f ORDER BY ${orderBy}, f.id ASC LIMIT $25 OFFSET $26
    )
    SELECT r.*, f.room_type_catalog_name, f.room_type_catalog_status, f.total_units, f.vacant_units, f.school_id, f.school_name, f.campus,
      f.origin_distance_km, f.distance_km, f.effective_radius_km, f.radius_source, to_jsonb(b) AS public_parent,
      COALESCE((SELECT jsonb_agg(to_jsonb(u) ORDER BY lower(u.code)) FROM room_units u
        WHERE u.room_type_id = r.id AND u.building_id = b.id AND u.status <> 'archived'), '[]'::jsonb) AS room_units,
      ${publicAmenitiesSql('room', 'r')} AS public_amenities,
      ${publicAmenitiesSql('building', 'b')} AS public_building_amenities
    FROM selected f JOIN rooms r ON r.id = f.id JOIN buildings b ON b.id = f.building_id
    ORDER BY ${orderBy}, f.id ASC`, [...params, query.pageSize, pageOffset(query.page, query.pageSize)]),
    db.query<{ count: number; available: number }>(`${cte}
      SELECT COUNT(*)::int AS count, COALESCE(SUM(vacant_units), 0)::int AS available FROM filtered`, params),
  ]);
  const items = result.rows.map((row) => {
    const building = mapBuildingRow(row.public_parent);
    const room = toPublicRoom(withPublicAmenities(mapRoomRow(row), row.public_amenities), building);
    const context = toPublicBuilding({
      ...withPublicAmenities(building, row.public_building_amenities),
      originDistanceKm: row.origin_distance_km,
      nearestSchoolId: row.school_id, nearestSchoolName: row.school_name,
      nearestSchoolCampus: row.campus, nearestSchoolDistanceKm: row.distance_km,
      nearestSchoolEffectiveRadiusKm: row.effective_radius_km == null ? null : Number(row.effective_radius_km),
      nearestSchoolRadiusSource: row.radius_source,
      updatedAt: row.updated_at,
    });
    return publicRoomSearchItemSchema.parse({
      ...room,
      originDistanceKm: context.originDistanceKm,
      price: room.price > 0 ? room.price : null,
      priceState: room.price > 0 ? 'priced' : 'missing_price',
      buildingAmenityIds: row.public_building_amenities.map((item: { id: string }) => item.id),
      buildingAmenities: context.amenitiesBuilding,
      nearestSchoolId: context.nearestSchoolId, nearestSchoolName: context.nearestSchoolName,
      nearestSchoolCampus: context.nearestSchoolCampus, nearestSchoolDistanceKm: context.nearestSchoolDistanceKm,
      nearestSchoolEffectiveRadiusKm: context.nearestSchoolEffectiveRadiusKm,
      nearestSchoolRadiusSource: context.nearestSchoolRadiusSource, updatedAt: context.updatedAt,
    });
  });
  return {
    ...pageResult(items, query.page, query.pageSize, Number(totals.rows[0]?.count || 0)),
    // The eligible set contains each Type once and each Unit belongs to one Type,
    // even when several selected campuses match its building.
    availableUnitCount: Number(totals.rows[0]?.available || 0),
  };
}
