import { BadRequestException } from '@nestjs/common';
import {
  inventoryReadScopeSchema, publicBuildingSchema, publicRoomTypeSchema,
  type PublicBuilding, type PublicRoomType,
} from '@tinyhouse/contracts';

type Row = Record<string, any>;
export function withPublicAmenities<T extends Row>(record: T, entries: { id: string; name: string }[]) {
  return { ...record, amenityIds: entries.map((item) => item.id), publicAmenityNames: entries.map((item) => item.name) };
}

const text = (value: unknown) => typeof value === 'string' ? value : '';
const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string') : [];
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const date = (value: unknown) => value instanceof Date ? value.toISOString() : text(value) || null;
const PUBLIC_MAP_GRID_DEGREES = 0.002;
const PUBLIC_MAP_GRID_METERS = 200 as const;

function validCoordinatePair(latitude: unknown, longitude: unknown) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng } : null;
}

/** FE03.4/G01-B: expose only a coarse cell point, never the exact admin coordinates. */
export function publicApproximateMapPoint(latitude: unknown, longitude: unknown) {
  const exact = validCoordinatePair(latitude, longitude);
  if (!exact) return null;
  const cellCenter = (value: number) =>
    Number((Math.floor(value / PUBLIC_MAP_GRID_DEGREES) * PUBLIC_MAP_GRID_DEGREES + PUBLIC_MAP_GRID_DEGREES / 2).toFixed(6));
  let lat = cellCenter(exact.lat);
  const lng = cellCenter(exact.lng);
  // Extremely rare exact cell-center inputs must still not be returned unchanged.
  if (Math.abs(lat - exact.lat) < 1e-9 && Math.abs(lng - exact.lng) < 1e-9) {
    lat = Number((lat + PUBLIC_MAP_GRID_DEGREES / 4).toFixed(6));
  }
  return { lat, lng, precision: 'approximate' as const, gridMeters: PUBLIC_MAP_GRID_METERS };
}

/** SQL mirror of publicApproximateMapPoint. Alias is internal-only. */
export function publicApproximateMapPointSql(alias: 'b' | 'bb') {
  const latCenter = `(floor(${alias}.latitude / ${PUBLIC_MAP_GRID_DEGREES}) * ${PUBLIC_MAP_GRID_DEGREES} + ${PUBLIC_MAP_GRID_DEGREES / 2})`;
  const lngCenter = `(floor(${alias}.longitude / ${PUBLIC_MAP_GRID_DEGREES}) * ${PUBLIC_MAP_GRID_DEGREES} + ${PUBLIC_MAP_GRID_DEGREES / 2})`;
  const lat = `(CASE WHEN abs(${latCenter} - ${alias}.latitude) < 0.000000001
    AND abs(${lngCenter} - ${alias}.longitude) < 0.000000001
    THEN ${latCenter} + ${PUBLIC_MAP_GRID_DEGREES / 4}
    ELSE ${latCenter} END)`;
  return { lat, lng: lngCenter };
}

export function inventoryReadScope(value: unknown) {
  const parsed = inventoryReadScopeSchema.safeParse(value === undefined ? 'public' : value);
  if (!parsed.success) throw new BadRequestException({ error: 'Phạm vi đọc dữ liệu không hợp lệ.' });
  return parsed.data;
}

/** Only the unambiguous address forms approved in FE00.1 are exposed. */
export function publicAddress(value: unknown) {
  const original = text(value).normalize('NFC').trim();
  if (!original || /[<>]/u.test(original) || [...original].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) return { address: '', needsReview: true };
  const matches = [...original.matchAll(/(?:^|[\s,;])(ngõ)(?=[\s\d])/giu)];
  if (matches.length > 1) return { address: '', needsReview: true };
  if (!matches.length) {
    if (/ngõ|ngách|hẻm|(?:^|[\s,;])ngo\s*\d/iu.test(original)) return { address: '', needsReview: true };
    return { address: original, needsReview: false };
  }
  const match = matches[0];
  const address = original.slice(match.index! + match[0].length - match[1].length).trim();
  if (!/^ngõ\s+\d[\p{L}\d/.-]*(?:[\s,;]|$)/iu.test(address)) return { address: '', needsReview: true };
  return { address, needsReview: false };
}

/** Same accepted forms as publicAddress; evaluated BEFORE search/count/page. Alias is internal only. */
export function publicAddressSql(alias: 'b') {
  const a = `normalize(btrim(COALESCE(${alias}.address, '')), NFC)`;
  return `(CASE
    WHEN ${a} = '' OR ${a} ~ '[<>[:cntrl:]]' THEN ''
    WHEN regexp_count(${a}, '(?i)(^|[[:space:],;])ngõ(?=[[:space:]0-9])') > 1 THEN ''
    WHEN ${a} ~* '(^|[[:space:],;])ngõ(?=[[:space:]0-9])' THEN
      CASE WHEN ${a} ~* '(^|[[:space:],;])ngõ[[:space:]]+[0-9][[:alnum:]/.-]*([[:space:],;]|$)'
        THEN btrim(regexp_replace(${a}, '(?i)^.*?(?=ngõ(?=[[:space:]0-9]))', '')) ELSE '' END
    WHEN ${a} ~* 'ngõ|ngách|hẻm|(^|[[:space:],;])ngo[[:space:]]*[0-9]' THEN ''
    ELSE ${a} END)`;
}

function plainText(value: unknown) {
  return text(value)
    .replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, entity: string) => {
      const point = entity[0].toLowerCase() === 'x' ? parseInt(entity.slice(1), 16) : Number(entity);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, key: string) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    }[key.toLowerCase()] || ''))
    .replace(/<[^>]*>/g, '')
    .normalize('NFC').trim();
}

function publicText(value: unknown, building: Row) {
  let output = plainText(value);
  const rawAddress = plainText(building.address);
  const shown = publicAddress(building.address).address;
  if (rawAddress && rawAddress !== shown) output = output.split(rawAddress).join(shown);
  for (const key of ['hostName', 'hostPhone', 'hostEmail', 'hostAddress']) {
    const secret = plainText(building[key]);
    if (secret && output.toLocaleLowerCase('vi-VN').includes(secret.toLocaleLowerCase('vi-VN'))) return '';
  }
  return output;
}

function publicImages(value: unknown, building: Row) {
  return strings(value).filter((image) => {
    if (!/^(?:https?:\/\/|\/(?!\/))/i.test(image) || /[<>\s]/u.test(image)) return false;
    let decoded: string;
    try { decoded = decodeURIComponent(image); } catch { return false; }
    return publicText(decoded, building) === decoded;
  });
}

function publicMedia360(value: unknown, building: Row) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw as Row : {};
    const id = text(item.id).trim();
    const kind = item.kind === 'panorama_image' || item.kind === 'tour_url' ? item.kind : '';
    const url = text(item.url).trim();
    if (!id || id.length > 120 || /[<>\s]/u.test(id) || !kind || !url || /[<>\s]/u.test(url)) return [];
    const safeUrl = kind === 'panorama_image'
      ? (/^\/uploads\/[A-Za-z0-9._/-]+$/u.test(url) || /^https:\/\/[^\s]+$/i.test(url))
      : /^https:\/\/[^\s]+$/i.test(url);
    if (!safeUrl) return [];
    let decoded: string;
    try { decoded = decodeURIComponent(url); } catch { return []; }
    if (publicText(decoded, building) !== decoded) return [];
    const sortOrder = Number.isInteger(Number(item.sortOrder))
      ? Math.max(0, Math.min(9999, Number(item.sortOrder))) : index;
    return [{
      id,
      kind,
      url,
      title: publicText(item.title, building).slice(0, 180),
      sortOrder,
    }];
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function toPublicBuilding(building: Row): PublicBuilding {
  const withdrawn = building.status === 'archived';
  const address = publicAddress(building.address);
  const amenities = Array.isArray(building.publicAmenityNames) ? strings(building.publicAmenityNames) : [...strings(building.amenitiesBuilding), ...strings(building.amenitiesBuildingChung),
    ...strings(building.amenitiesBuildingAnNinh), ...strings(building.amenitiesBuildingPccc),
    ...strings(building.amenitiesBuildingThoatNan), ...strings(building.amenitiesPccc)];
  return publicBuildingSchema.parse({
    id: building.id, code: publicText(building.code, building), name: publicText(building.name, building),
    status: building.status, ownerType: building.ownerType, isTiny: building.ownerType === 'tiny',
    address: address.address, addressNeedsReview: address.needsReview,
    district: publicText(building.district, building), ward: publicText(building.ward, building), city: publicText(building.city, building),
    listingState: withdrawn ? 'withdrawn' : 'listed', acceptsBookings: !withdrawn,
    vacantRoomsCount: Math.max(0, number(building.vacantRoomsCount)),
    totalRoomsCount: Math.max(0, number(building.totalRoomsCount)),
    minPrice: number(building.minPrice) > 0 ? number(building.minPrice) : null,
    maxPrice: number(building.maxPrice) > 0 ? number(building.maxPrice) : null,
    priceState: number(building.vacantRoomsCount) <= 0 ? 'no_available_units'
      : number(building.minPrice) > 0 ? 'priced' : 'missing_price',
    coverImage: publicImages([building.coverImage], building)[0] || '',
    images: publicImages(building.images, building),
    // FE04.5: media360 is a strict safe projection; tour URLs are links only, never arbitrary embeds.
    media360: publicMedia360(building.media360, building), amenityIds: strings(building.amenityIds),
    // Exact admin coordinates remain private; G01-B exposes only a coarse public map point.
    mapPoint: publicApproximateMapPoint(building.latitude, building.longitude),
    amenitiesBuilding: [...new Set(amenities.map((item) => publicText(item, building)).filter(Boolean))],
    nearestSchoolId: building.nearestSchoolId || null,
    originDistanceKm: building.originDistanceKm == null ? null : Math.round(number(building.originDistanceKm) * 10) / 10,
    nearestSchoolName: publicText(building.nearestSchoolName, building) || null,
    nearestSchoolCampus: publicText(building.nearestSchoolCampus, building) || null,
    nearestSchoolDistanceKm: building.nearestSchoolDistanceKm == null ? null : Math.ceil(number(building.nearestSchoolDistanceKm) * 10) / 10,
    nearestSchoolEffectiveRadiusKm: building.nearestSchoolEffectiveRadiusKm ?? null,
    nearestSchoolRadiusSource: building.nearestSchoolRadiusSource ?? null,
    updatedAt: date(building.updatedAt),
  });
}

export function toPublicRoom(room: Row, building: Row): PublicRoomType {
  const withdrawn = room.lifecycleStatus === 'archived' || building.status === 'archived';
  const address = publicAddress(building.address);
  const units = (Array.isArray(room.roomUnits) ? room.roomUnits : [])
    .filter((unit: Row) => ['available', 'occupied', 'maintenance'].includes(unit.status)
      && unit.roomTypeId === room.id && unit.buildingId === building.id)
    .map((unit: Row) => ({
      id: unit.id, roomTypeId: room.id, buildingId: building.id,
      code: publicText(unit.code, building), status: unit.status, availableFrom: unit.availableFrom || null,
    }));
  const vacant = units.filter((unit: Row) => unit.status === 'available').length;
  const amenities = (Array.isArray(room.publicAmenityNames) ? strings(room.publicAmenityNames) : ['amenities', 'amenitiesNoiThat', 'amenitiesThietBiDien', 'amenitiesKhuVucBep',
    'amenitiesDacDiemRieng', 'amenitiesRieng', 'amenitiesChung', 'amenitiesAnNinh', 'amenitiesPccc', 'amenitiesAnToan']
    .flatMap((key) => strings(room[key]))).map((item) => publicText(item, building)).filter(Boolean);
  return publicRoomTypeSchema.parse({
    id: room.id, roomTypeId: room.id, buildingId: building.id,
    buildingCode: publicText(building.code, building), buildingName: publicText(building.name, building),
    ownerType: building.ownerType, address: address.address, addressNeedsReview: address.needsReview,
    lifecycleStatus: room.lifecycleStatus, listingState: withdrawn ? 'withdrawn' : 'listed', acceptsBookings: !withdrawn,
    status: withdrawn ? 'archived' : vacant > 0 ? 'Có sẵn' : units.length > 0 ? 'Hết phòng' : 'Chưa có căn',
    price: number(room.price), type: publicText(room.type, building),
    roomTypeCatalogId: room.roomTypeCatalogId, roomTypeCatalogName: publicText(room.roomTypeCatalogName, building),
    roomTypeCatalogStatus: room.roomTypeCatalogStatus,
    audienceGroups: room.audienceGroups || [],
    area: number(room.area), maxOccupants: number(room.maxOccupants),
    coverImage: publicImages([room.coverImage], building)[0] || '', images: publicImages(room.images, building),
    media360: publicMedia360(room.media360, building),
    description: publicText(room.description, building), amenities: [...new Set(amenities)], amenityIds: strings(room.amenityIds),
    roomUnits: units, totalUnits: units.length, vacantCount: vacant,
    nextAvailableFrom: units.filter((unit: Row) => unit.status !== 'available')
      .map((unit: Row) => unit.availableFrom).filter(Boolean).sort()[0] || null,
  });
}
