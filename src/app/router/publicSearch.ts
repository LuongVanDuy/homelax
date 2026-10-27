import { decodeMapPolygon, defaultRoomTypeCatalogIdByLegacyName, publicMapBoundsSchema, searchOriginSchema, type SearchOrigin, type PublicMapBounds } from '@tinyhouse/contracts';

export const defaultPublicSearch = {
  nearSchool: '', ward: 'all', schoolId: 'all', schoolIds: [] as string[], amenityIds: [] as string[], roomTypeIds: [] as string[], minPrice: 0, maxPrice: 50_000_000,
  q: '', owner: 'all', audience: '', sort: 'smart', view: 'grid', page: 1, pageSize: 21, availability: 'all',
  region: null as PublicMapBounds | null,
  origin: null as SearchOrigin | null,
};
export type PublicSearch = typeof defaultPublicSearch;
const keys = Object.keys(defaultPublicSearch) as (keyof PublicSearch)[];
const choice = (value: string | null, options: string[], fallback: string) => options.includes(value || '') ? value! : fallback;
const number = (value: string | null, fallback: number, min: number, max: number) =>
  value !== null && value.trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;

const ids = (values: string[]) => [...new Set(values.flatMap(value => value.split(',')).map(value => value.trim()).filter(value => value && value !== 'all'))];
export function selectedSchoolIds(state: Pick<PublicSearch, 'schoolId' | 'schoolIds'>) {
  return state.schoolIds.length ? state.schoolIds : state.schoolId === 'all' ? [] : [state.schoolId];
}

function readMapRegion(params: URLSearchParams): PublicMapBounds | null {
  const keys = ['mapSouth', 'mapWest', 'mapNorth', 'mapEast'] as const;
  if (keys.every((key) => !params.has(key))) return null;
  if (keys.some((key) => !params.has(key))) return null;
  const polygon = decodeMapPolygon(params.get('mapPolygon') || undefined);
  if (params.has('mapPolygon') && !polygon) return null;
  const parsed = publicMapBoundsSchema.safeParse({
    type: 'bounds',
    south: Number(params.get('mapSouth')),
    west: Number(params.get('mapWest')),
    north: Number(params.get('mapNorth')),
    east: Number(params.get('mapEast')),
    ...(polygon ? { polygon } : {}),
  });
  return parsed.success ? parsed.data : null;
}

const mapNumber = (value: number) => Number(value.toFixed(6)).toString();

function readOrigin(p: URLSearchParams): SearchOrigin | null {
  if (!p.get('originLat')?.trim() || !p.get('originLng')?.trim()) return null;
  const parsed = searchOriginSchema.safeParse({
    lat: Number(p.get('originLat')), lng: Number(p.get('originLng')),
    label: p.get('originLabel') || 'Địa chỉ đã chọn',
    radiusKm: p.has('radiusKm') ? Number(p.get('radiusKm')) : null,
  });
  return parsed.success ? parsed.data : null;
}

export function readPublicSearch(search: string): PublicSearch {
  const p = new URLSearchParams(search);
  const origin = readOrigin(p);
  const minPrice = number(p.get('minPrice'), 0, 0, 50_000_000);
  const maxPrice = number(p.get('maxPrice'), 50_000_000, 0, 50_000_000);
  const schools = ids(p.has('schoolIds') ? p.getAll('schoolIds') : [p.get('schoolId') || p.get('university') || '']);
  const legacyRoomTypeNames = ids(p.getAll('roomTypes').length ? p.getAll('roomTypes') : [p.get('roomType') || '']);
  const roomTypeIds = p.has('roomTypeIds')
    ? ids(p.getAll('roomTypeIds'))
    : legacyRoomTypeNames.map(defaultRoomTypeCatalogIdByLegacyName).filter(Boolean) as string[];
  return {
    schoolIds: schools.length > 1 ? schools : [], amenityIds: ids(p.getAll('amenityIds')),
    ward: p.get('ward') || p.get('district') || 'all', schoolId: schools.length === 1 ? schools[0] : 'all',
    roomTypeIds,
    minPrice: Math.min(minPrice, maxPrice), maxPrice: Math.max(minPrice, maxPrice), q: p.get('q') || '',
    owner: choice(p.get('owner'), ['all', 'tiny', 'partner'], 'all'),
    audience: choice(p.get('audience'), ['student', 'young-worker', 'couple', 'family'], ''),
    sort: choice(p.get('sort'), ['smart', 'nearest', 'updated', 'vacant-asc', 'vacant-desc', 'price-asc', 'price-desc', ...(origin ? ['distance'] : [])], 'smart'),
    view: choice(p.get('view'), ['grid', 'split', 'map'], 'grid'),
    page: number(p.get('page'), 1, 1, 1_000_000), pageSize: Number(choice(p.get('pageSize'), ['6', '12', '21', '42'], '21')),
    availability: choice(p.get('availability'), ['all', 'available'], 'all'),
    region: readMapRegion(p),
    origin,
    nearSchool: p.get('nearSchool') === 'any' ? 'any' : '',
  };
}

export function writePublicSearch(state: PublicSearch, original = '') {
  const schools = ids(selectedSchoolIds(state));
  state = { ...state, schoolId: schools.length === 1 ? schools[0] : 'all', schoolIds: schools.length > 1 ? schools : [], amenityIds: ids(state.amenityIds) };
  const p = new URLSearchParams(original);
  for (const key of [...keys, 'district', 'roomType', 'roomTypes', 'roomTypeIds', 'university', 'mapSouth', 'mapWest', 'mapNorth', 'mapEast', 'mapPolygon', 'originLat', 'originLng', 'originLabel', 'radiusKm']) p.delete(key);
  for (const key of keys) {
    if (key === 'region' || key === 'origin') continue;
    const value = state[key];
    if (Array.isArray(value)) value.forEach(item => p.append(key, item));
    else if (value !== defaultPublicSearch[key]) p.set(key, String(value));
  }
  if (state.region) {
    p.set('mapSouth', mapNumber(state.region.south));
    p.set('mapWest', mapNumber(state.region.west));
    p.set('mapNorth', mapNumber(state.region.north));
    p.set('mapEast', mapNumber(state.region.east));
    if (state.region.polygon) p.set('mapPolygon', JSON.stringify(state.region.polygon.map(point => point.map(n => Number(mapNumber(n))))));
  }
  if (state.origin) {
    p.set('originLat', mapNumber(state.origin.lat)); p.set('originLng', mapNumber(state.origin.lng));
    p.set('originLabel', state.origin.label);
    if (state.origin.radiusKm !== null) p.set('radiusKm', String(state.origin.radiusKm));
  } else if (state.sort === 'distance') p.delete('sort');
  return p.size ? `?${p}` : '';
}

export function patchPublicSearch(search: string, patch: Partial<PublicSearch>) {
  const resetPage = Object.keys(patch).some(key => key !== 'page' && key !== 'view');
  const schoolPatch = 'schoolIds' in patch ? { schoolId: 'all', schoolIds: patch.schoolIds || [] }
    : 'schoolId' in patch ? { schoolIds: [] } : {};
  return writePublicSearch({ ...readPublicSearch(search), ...patch, ...schoolPatch, ...(resetPage ? { page: 1 } : {}) }, search);
}
