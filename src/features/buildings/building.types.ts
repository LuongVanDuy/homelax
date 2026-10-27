import { media360ListSchema, publicApproximateMapPointSchema, type BuildingWrite, type Media360Item, type PublicApproximateMapPoint } from '@tinyhouse/contracts';

export type BuildingRecord = Omit<BuildingWrite, 'latitude' | 'longitude' | 'status' | 'amenityIds'> & {
  id: string;
  listingState?: 'listed' | 'withdrawn';
  acceptsBookings?: boolean;
  code: string;
  name: string;
  address: string;
  city: string;
  district: string;
  ward: string;
  mapPoint: PublicApproximateMapPoint | null;
  latitude: number | null;
  longitude: number | null;
  ownerType: 'tiny' | 'partner';
  isTiny: boolean;
  ownerId?: string;
  createdBy?: string;
  allowedViewerIds: string[];
  nearestSchoolId: string | null;
  nearestSchoolName: string | null;
  nearestSchoolCampus: string | null;
  nearestSchoolDistanceKm: number | null;
  nearestSchoolEffectiveRadiusKm: number | null;
  nearestSchoolRadiusSource: 'school' | 'default' | null;
  status: 'active' | 'archived';
  deletedAt?: string | null;
  minPrice: number;
  maxPrice: number;
  vacantRoomsCount: number;
  totalRoomsCount?: number;
  coverImage: string;
  images: string[];
  media360: Media360Item[];
  amenityIds: string[];
  amenitiesBuilding?: string[];
  hostName: string;
  hostPhone: string;
  hostEmail: string;
  hostAddress: string;
  createdAt?: string;
  updatedAt?: string;
};

export function toBuildingRecord(value: unknown): BuildingRecord {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const images = Array.isArray(row.images) ? row.images.map(String).filter(Boolean) : [];
  const ownerType = row.ownerType === 'partner' ? 'partner' : 'tiny';
  const media360Result = media360ListSchema.safeParse(row.media360);
  const mapPointResult = publicApproximateMapPointSchema.safeParse(row.mapPoint);
  return {
    ...(row as BuildingWrite),
    id: String(row.id || ''),
    code: String(row.code || ''),
    name: String(row.name || ''),
    address: String(row.address || ''),
    city: String(row.city || ''),
    district: String(row.district || ''),
    ward: String(row.ward || ''),
    mapPoint: mapPointResult.success ? mapPointResult.data : null,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    ownerType,
    isTiny: row.isTiny === undefined ? ownerType === 'tiny' : Boolean(row.isTiny),
    ownerId: row.ownerId ? String(row.ownerId) : '',
    createdBy: row.createdBy ? String(row.createdBy) : '',
    allowedViewerIds: Array.isArray(row.allowedViewerIds) ? row.allowedViewerIds.map(String) : [],
    nearestSchoolId: row.nearestSchoolId ? String(row.nearestSchoolId) : null,
    nearestSchoolName: row.nearestSchoolName ? String(row.nearestSchoolName) : null,
    nearestSchoolCampus: row.nearestSchoolCampus ? String(row.nearestSchoolCampus) : null,
    nearestSchoolDistanceKm: row.nearestSchoolDistanceKm === null || row.nearestSchoolDistanceKm === undefined
      ? null
      : Number(row.nearestSchoolDistanceKm),
    nearestSchoolEffectiveRadiusKm: row.nearestSchoolEffectiveRadiusKm === null || row.nearestSchoolEffectiveRadiusKm === undefined
      ? null
      : Number(row.nearestSchoolEffectiveRadiusKm),
    nearestSchoolRadiusSource: row.nearestSchoolRadiusSource === 'school'
      ? 'school'
      : row.nearestSchoolRadiusSource === 'default'
        ? 'default'
        : null,
    status: row.status === 'archived' ? 'archived' : 'active',
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
    minPrice: Number(row.minPrice || 0),
    maxPrice: Number(row.maxPrice || 0),
    vacantRoomsCount: Number(row.vacantRoomsCount || 0),
    totalRoomsCount: Number(row.totalRoomsCount || 0),
    coverImage: String(row.coverImage || images[0] || ''),
    images,
    media360: media360Result.success ? media360Result.data : [],
    amenityIds: Array.isArray(row.amenityIds) ? row.amenityIds.map(String) : [],
    amenitiesBuilding: Array.isArray(row.amenitiesBuilding) ? row.amenitiesBuilding.map(String) : [],
    hostName: String(row.hostName || ''),
    hostPhone: String(row.hostPhone || ''),
    hostEmail: String(row.hostEmail || ''),
    hostAddress: String(row.hostAddress || ''),
    createdAt: row.createdAt ? String(row.createdAt) : '',
    updatedAt: row.updatedAt ? String(row.updatedAt) : '',
  };
}
