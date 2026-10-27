// Shared eligible Type/Unit set for public Search, building aggregates and school counts.
// Each Unit belongs to exactly one Type; mismatched parent IDs never contribute.
export const PUBLIC_INVENTORY_CTE = `public_inventory AS (
  SELECT r.id, r.building_id, r.price,
    COUNT(DISTINCT u.id) FILTER (WHERE u.status <> 'archived')::int AS total_units,
    COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'available')::int AS vacant_units
  FROM rooms r
  JOIN buildings b ON b.id = r.building_id
  LEFT JOIN room_units u ON u.room_type_id = r.id AND u.building_id = b.id
  WHERE r.lifecycle_status = 'active' AND r.deleted_at IS NULL
    AND b.status = 'active' AND b.deleted_at IS NULL
  GROUP BY r.id
)`;

// Aliases are internal constants, never request input.
export function schoolDistanceSql(buildingAlias: 'b' | 'bb', schoolAlias = 's') {
  return `2 * 6371.0088 * ASIN(SQRT(LEAST(1, GREATEST(0,
    POWER(SIN(RADIANS(${schoolAlias}.latitude - ${buildingAlias}.latitude) / 2), 2)
    + COS(RADIANS(${buildingAlias}.latitude)) * COS(RADIANS(${schoolAlias}.latitude))
    * POWER(SIN(RADIANS(${schoolAlias}.longitude - ${buildingAlias}.longitude) / 2), 2)
  ))))`;
}

export function csvValues(value: string) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

// Public readers use live catalog assignments, never the legacy display-name arrays.
export function publicAmenitiesSql(scope: 'building' | 'room', alias: 'b' | 'r') {
  const table = scope === 'building' ? 'building_amenities' : 'room_type_amenities';
  const parent = scope === 'building' ? 'building_id' : 'room_type_id';
  return `COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) ORDER BY a.sort_order, a.id)
    FROM ${table} assignment JOIN amenities a ON a.id = assignment.amenity_id
    WHERE assignment.${parent} = ${alias}.id AND a.scope = '${scope}' AND a.status = 'active'), '[]'::jsonb)`;
}
import { publicApproximateMapPointSql } from './public-inventory.js';

// All aliases/parameter indexes are internal constants. Never calculate public
// arbitrary-origin distances from exact admin coordinates (location oracle).
export function originDistanceSql(alias: 'b' | 'bb', latParam: number, lngParam: number) {
  const point = publicApproximateMapPointSql(alias);
  return `(CASE WHEN $${latParam}::double precision IS NULL OR $${lngParam}::double precision IS NULL
    OR ${alias}.latitude IS NULL OR ${alias}.longitude IS NULL THEN NULL ELSE
    2 * 6371.0088 * ASIN(SQRT(LEAST(1, GREATEST(0,
      POWER(SIN(RADIANS($${latParam}::double precision - (${point.lat})) / 2), 2)
      + COS(RADIANS((${point.lat}))) * COS(RADIANS($${latParam}::double precision))
      * POWER(SIN(RADIANS($${lngParam}::double precision - (${point.lng})) / 2), 2)
    )))) END)`;
}

