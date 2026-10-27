import type { BuildingListQuery } from '@tinyhouse/contracts';
import { publicBuildingMapQuerySchema } from '@tinyhouse/contracts';
import { selectedSchoolIds, type PublicSearch } from '../../app/router/publicSearch.js';

export const discoverySortOptions = [
  { value: 'smart', label: 'Phù hợp nhất' },
  { value: 'nearest', label: 'Gần trường nhất' },
  { value: 'distance', label: 'Gần địa chỉ đã chọn nhất' },
  { value: 'price-asc', label: 'Giá thuê: Thấp → Cao' },
  { value: 'price-desc', label: 'Giá thuê: Cao → Thấp' },
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'vacant-desc', label: 'Còn trống nhiều nhất' },
  { value: 'vacant-asc', label: 'Còn trống ít nhất' },
] as const;

export function buildingSearchParams(filters: PublicSearch, search = filters.q): Partial<BuildingListQuery> {
  const sort: BuildingListQuery['sort'] = filters.sort === 'price-asc' ? 'priceAsc'
    : filters.sort === 'price-desc' ? 'priceDesc'
    : filters.sort === 'updated' ? 'updated'
    : filters.sort === 'nearest' ? 'nearest'
    : filters.sort === 'distance' && filters.origin ? 'distance'
    : ['vacant-asc', 'vacant-desc'].includes(filters.sort) ? 'vacantRoomsCount' : 'smart';
  return {
    scope: 'public', status: 'active',
    search: search.trim(), page: filters.page, pageSize: filters.pageSize,
    ownerType: filters.owner === 'tiny' || filters.owner === 'partner' ? filters.owner : '',
    ward: filters.ward === 'all' ? '' : filters.ward,
    roomTypeIds: filters.roomTypeIds.join(','),
    audience: filters.audience as BuildingListQuery['audience'],
    schoolIds: selectedSchoolIds(filters).join(','),
    nearSchool: filters.nearSchool === 'any' ? 'any' : '',
    amenityIds: filters.amenityIds.join(','),
    minPrice: filters.minPrice,
    // The public control calls the default range "Tất cả mức giá". Do not exclude
    // missing prices or prices above its slider ceiling when that range is selected.
    maxPrice: filters.maxPrice === 50_000_000 ? 0 : filters.maxPrice,
    availability: filters.availability === 'available' ? 'available' : '',
    mapSouth: filters.region?.south, mapWest: filters.region?.west,
    mapNorth: filters.region?.north, mapEast: filters.region?.east,
    originLat: filters.origin?.lat, originLng: filters.origin?.lng, radiusKm: filters.origin?.radiusKm ?? undefined,
    ...(filters.region?.polygon ? { mapPolygon: JSON.stringify(filters.region.polygon) } : {}),
    sort, order: filters.sort === 'vacant-asc' ? 'asc' : 'desc',
  };
}

/** Only membership affects map data: never page, pageSize, sort or view. */
export function buildingMapParams(filters: PublicSearch, search = filters.q) {
  const { page: _page, pageSize: _pageSize, sort: _sort, order: _order, status: _status, ...membership } = buildingSearchParams(filters, search);
  const query = publicBuildingMapQuerySchema.parse(membership);
  for (const key of ['schoolIds', 'amenityIds', 'roomTypeIds'] as const) query[key] = query[key].split(',').filter(Boolean).sort().join(',');
  return query;
}
