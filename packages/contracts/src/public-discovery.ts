import { z } from 'zod';
import { listQueryBaseSchema } from './list.js';
import { publicRoomTypeSchema, publicBuildingSchema, publicRoomPageSchema } from './public-inventory.js';
import { buildingListQuerySchema, validateBuildingRegion } from './buildings.js';
import { originQueryFields, validateSearchOrigin } from './location-search.js';

export const publicRoomSearchQuerySchema = listQueryBaseSchema.extend({
  ...originQueryFields,
  building: z.string().trim().max(200).default(''),
  ownerType: z.enum(['', 'tiny', 'partner']).default(''),
  ward: z.string().trim().max(160).default(''),
  roomTypeIds: z.string().trim().max(5000).default(''),
  roomTypes: z.string().trim().max(1000).default(''),
  schoolIds: z.string().trim().max(5000).default(''),
  nearSchool: buildingListQuerySchema.shape.nearSchool,
  audience: buildingListQuerySchema.shape.audience,
  mapSouth: buildingListQuerySchema.shape.mapSouth,
  mapWest: buildingListQuerySchema.shape.mapWest,
  mapNorth: buildingListQuerySchema.shape.mapNorth,
  mapEast: buildingListQuerySchema.shape.mapEast,
  mapPolygon: buildingListQuerySchema.shape.mapPolygon,
  amenityIds: z.string().trim().max(5000).default(''),
  minPrice: z.coerce.number().finite().nonnegative().default(0),
  maxPrice: z.coerce.number().finite().nonnegative().default(0),
  availability: z.enum(['', 'available', 'full', 'empty']).default(''),
  sort: z.enum(['smart', 'nearest', 'distance', 'priceAsc', 'priceDesc', 'updated', 'type', 'vacantCount']).default('smart'),
  order: z.enum(['asc', 'desc']).default('desc'),
}).strict().superRefine(validateSearchOrigin).superRefine((data, context) => validateBuildingRegion({ ...data, scope: 'public' }, context)).refine((query) => query.maxPrice === 0 || query.minPrice <= query.maxPrice, {
  path: ['maxPrice'], message: 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.',
});

export const publicRoomSearchItemSchema = publicRoomTypeSchema.extend({
  price: z.number().positive().nullable(),
  priceState: z.enum(['priced', 'missing_price']),
  buildingAmenityIds: z.array(z.string()),
  buildingAmenities: z.array(z.string()),
  ...publicBuildingSchema.pick({
    originDistanceKm: true, nearestSchoolId: true, nearestSchoolName: true, nearestSchoolCampus: true,
    nearestSchoolDistanceKm: true, nearestSchoolEffectiveRadiusKm: true,
    nearestSchoolRadiusSource: true, updatedAt: true,
  }).shape,
}).strict();

export const publicRoomSearchPageSchema = publicRoomPageSchema.extend({
  items: z.array(publicRoomSearchItemSchema),
  availableUnitCount: z.number().int().nonnegative(),
}).strict();

export type PublicRoomSearchQuery = z.infer<typeof publicRoomSearchQuerySchema>;
