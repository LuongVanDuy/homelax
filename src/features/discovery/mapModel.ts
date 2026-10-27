import { PUBLIC_PRICE_TEXT, type PublicBuildingMapItem, type PublicMapBounds } from '@tinyhouse/contracts';

export type SearchMapCamera = { lat: number; lng: number; zoom: number };
export type BuildingMapGroup = { key: string; lat: number; lng: number; members: PublicBuildingMapItem[] };

/** World-pixel buckets stay stable while panning. Counts are distinct buildings, never Units. */
export function groupBuildingMapPoints(items: PublicBuildingMapItem[], zoom: number): BuildingMapGroup[] {
  const scale = 256 * 2 ** Math.floor(zoom);
  const buckets = new Map<string, PublicBuildingMapItem[]>();
  const unique = new Map(items.map(item => [item.id, item]));
  for (const item of [...unique.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const { lat, lng } = item.mapPoint;
    const sin = Math.sin(Math.max(-85.051128, Math.min(85.051128, lat)) * Math.PI / 180);
    const x = (lng + 180) / 360 * scale;
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    const key = `${Math.floor(x / 92)}:${Math.floor(y / 92)}`;
    const members = buckets.get(key) || [];
    members.push(item);
    buckets.set(key, members);
  }
  return [...buckets].map(([key, members]) => ({
    key, members,
    lat: members.reduce((sum, b) => sum + b.mapPoint.lat, 0) / members.length,
    lng: members.reduce((sum, b) => sum + b.mapPoint.lng, 0) / members.length,
  }));
}

export function buildingMapPrice(item: Pick<PublicBuildingMapItem, 'priceState' | 'minPrice' | 'vacantRoomsCount'>, compact = false) {
  if (item.priceState === 'no_available_units' || item.vacantRoomsCount <= 0) return PUBLIC_PRICE_TEXT.no_available_units;
  if (item.priceState !== 'priced' || !item.minPrice) return compact ? 'Liên hệ' : PUBLIC_PRICE_TEXT.missing_price;
  return compact
    ? `Từ ${(item.minPrice / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr`
    : `Từ ${item.minPrice.toLocaleString('vi-VN')} đ/tháng`;
}

export function sameCamera(a: SearchMapCamera | null, b: SearchMapCamera | null) {
  return Boolean(a && b && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7 && a.zoom === b.zoom);
}

export function regionKey(region: PublicMapBounds | null) {
  return region ? [region.south, region.west, region.north, region.east].map(n => n.toFixed(6)).join(':') + (region.polygon ? JSON.stringify(region.polygon) : '') : '';
}
