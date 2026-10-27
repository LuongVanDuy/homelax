import { z } from 'zod';
import { buildingListItemSchema } from './buildings.js';
import { roomTypeSchema } from './rooms.js';
import { pagedResponseSchema } from './list.js';

export const inventoryReadScopeSchema = z.enum(['public', 'cms']);
export const publicListingStateSchema = z.enum(['listed', 'withdrawn']);
export const PUBLIC_LISTING_WITHDRAWN_TEXT = 'Thông tin này đã ngừng nhận khách. Hiện không thể đặt lịch xem.';
export const PUBLIC_PRICE_TEXT = {
  no_available_units: 'Hết phòng trống',
  missing_price: 'Liên hệ để biết giá',
} as const;

export function publicBuildingPriceFallback(building: { vacantRoomsCount?: number }) {
  return Number(building.vacantRoomsCount || 0) > 0
    ? PUBLIC_PRICE_TEXT.missing_price : PUBLIC_PRICE_TEXT.no_available_units;
}
// F023 / F024: common Homelax contact, never a landlord fallback.
export const TINY_HOUSES_PUBLIC_CONTACT = {
  name: 'Homelax',
  phone: '0965066598',
  zaloUrl: 'https://zalo.me/0965066598',
} as const;

export const publicApproximateMapPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.literal('approximate'),
  gridMeters: z.literal(200),
}).strict();

export const publicRoomUnitSchema = z.object({
  id: z.string().min(1),
  roomTypeId: z.string().min(1),
  buildingId: z.string().min(1),
  code: z.string(),
  status: z.enum(['available', 'occupied', 'maintenance']),
  availableFrom: z.string().nullable(),
}).strict();

export const publicRoomTypeSchema = roomTypeSchema.pick({
  id: true, roomTypeId: true, buildingId: true, buildingCode: true, buildingName: true,
  lifecycleStatus: true, status: true, price: true, type: true, area: true,
  maxOccupants: true, roomTypeCatalogId: true, roomTypeCatalogName: true, roomTypeCatalogStatus: true,
  coverImage: true, images: true, media360: true,
  description: true, amenityIds: true, totalUnits: true, vacantCount: true,
  nextAvailableFrom: true, audienceGroups: true,
}).extend({
  roomUnits: z.array(publicRoomUnitSchema),
  address: z.string(),
  addressNeedsReview: z.boolean(),
  ownerType: z.enum(['tiny', 'partner']),
  listingState: publicListingStateSchema,
  acceptsBookings: z.boolean(),
  amenities: z.array(z.string()),
}).strict();

export const publicBuildingSchema = buildingListItemSchema.pick({
  id: true, code: true, name: true, status: true, ownerType: true,
  address: true, district: true, ward: true, city: true,
  vacantRoomsCount: true, totalRoomsCount: true,
  minPrice: true, maxPrice: true, coverImage: true, images: true, media360: true,
  amenityIds: true, nearestSchoolId: true, nearestSchoolName: true,
  nearestSchoolCampus: true, nearestSchoolDistanceKm: true,
  nearestSchoolEffectiveRadiusKm: true, nearestSchoolRadiusSource: true,
  updatedAt: true,
}).extend({
  status: z.enum(['active', 'archived']),
  minPrice: z.number().positive().nullable(),
  maxPrice: z.number().positive().nullable(),
  priceState: z.enum(['priced', 'no_available_units', 'missing_price']),
  ownerType: z.enum(['tiny', 'partner']),
  isTiny: z.boolean(),
  addressNeedsReview: z.boolean(),
  listingState: publicListingStateSchema,
  acceptsBookings: z.boolean(),
  amenitiesBuilding: z.array(z.string()),
  mapPoint: publicApproximateMapPointSchema.nullable(),
  originDistanceKm: z.number().nonnegative().nullable().default(null),
}).strict();

// A bounded map payload, not another paginated list and not a CMS DTO.
export const PUBLIC_BUILDING_MAP_LIMIT = 5000;
export const publicBuildingMapItemSchema = publicBuildingSchema.pick({
  id: true, code: true, name: true, ownerType: true,
  address: true, district: true, ward: true, city: true,
  coverImage: true, minPrice: true, priceState: true, vacantRoomsCount: true,
}).extend({ mapPoint: publicApproximateMapPointSchema }).strict();
export const publicBuildingMapResultSchema = z.object({
  total: z.number().int().nonnegative(),
  mappableTotal: z.number().int().nonnegative(),
  missingLocationTotal: z.number().int().nonnegative(),
  limit: z.literal(PUBLIC_BUILDING_MAP_LIMIT),
  truncated: z.boolean(),
  markers: z.array(publicBuildingMapItemSchema).max(PUBLIC_BUILDING_MAP_LIMIT),
}).strict();
export type PublicBuildingMapItem = z.infer<typeof publicBuildingMapItemSchema>;
export type PublicBuildingMapResult = z.infer<typeof publicBuildingMapResultSchema>;

export const publicBuildingDetailSchema = publicBuildingSchema.extend({
  rooms: z.array(publicRoomTypeSchema),
}).strict();
export const publicBuildingPageSchema = pagedResponseSchema(publicBuildingSchema).strict();
export const publicRoomPageSchema = pagedResponseSchema(publicRoomTypeSchema).strict();
export type PublicApproximateMapPoint = z.infer<typeof publicApproximateMapPointSchema>;
export type PublicBuilding = z.infer<typeof publicBuildingSchema>;
export type PublicRoomType = z.infer<typeof publicRoomTypeSchema>;

// Shared endpoints select one shape according to the validated scope.
export const buildingReadPageSchema = pagedResponseSchema(z.union([publicBuildingSchema, buildingListItemSchema]));
export const buildingReadDetailSchema = z.union([publicBuildingDetailSchema, buildingListItemSchema]);
export const roomReadPageSchema = pagedResponseSchema(z.union([publicRoomTypeSchema, roomTypeSchema]));
export const roomReadDetailSchema = z.union([publicRoomTypeSchema, roomTypeSchema]);
