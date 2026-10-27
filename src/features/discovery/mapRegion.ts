import { publicMapBoundsSchema, type PublicMapBounds } from '@tinyhouse/contracts';

export const MAP_REGION_QUERY_KEYS = ['mapSouth', 'mapWest', 'mapNorth', 'mapEast', 'mapPolygon'] as const;

export function normalizeMapBounds(value: unknown): PublicMapBounds | null {
  const parsed = publicMapBoundsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function sameMapBounds(a: PublicMapBounds | null, b: PublicMapBounds | null, epsilon = 0.000001) {
  if (!a || !b) return a === b;
  return Math.abs(a.south - b.south) <= epsilon
    && Math.abs(a.west - b.west) <= epsilon
    && Math.abs(a.north - b.north) <= epsilon
    && Math.abs(a.east - b.east) <= epsilon
    && JSON.stringify(a.polygon) === JSON.stringify(b.polygon);
}

export function mapRegionFromPoints(polygon: [number, number][]): PublicMapBounds | null {
  if (polygon.length < 3) return null;
  return normalizeMapBounds({ type: 'bounds', polygon,
    south: Math.min(...polygon.map(p => p[0])), north: Math.max(...polygon.map(p => p[0])),
    west: Math.min(...polygon.map(p => p[1])), east: Math.max(...polygon.map(p => p[1])),
  });
}

export function mapBoundsLabel(bounds: PublicMapBounds | null) {
  if (!bounds) return '';
  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLng = (bounds.west + bounds.east) / 2;
  return `Tâm vùng ${centerLat.toFixed(3)}, ${centerLng.toFixed(3)}`;
}
