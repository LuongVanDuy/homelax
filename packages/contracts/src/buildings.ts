import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';
import { media360ListSchema } from './media.js';
import { decodeMapPolygon, publicMapBoundsSchema } from './map.js';
import { roomAudienceFilterSchema } from './room-audiences.js';
import { originQueryFields, validateSearchOrigin } from './location-search.js';

export const buildingListQuerySchema = listQueryBaseSchema.extend({
  ...originQueryFields,
  scope: z.enum(['public', 'cms']).default('public'),
  status: z.enum(['', 'active', 'archived']).default(''),
  ownerType: z.enum(['', 'tiny', 'partner']).default(''),
  availability: z.enum(['', 'available']).default(''),
  location: z.enum(['', 'located', 'missing']).default(''),
  ward: z.string().trim().max(160).default(''),
  universityWard: z.string().trim().max(160).default(''),
  schoolIds: z.string().trim().max(5000).default(''),
  nearSchool: z.enum(['', 'any']).default(''),
  amenityIds: z.string().trim().max(5000).default(''),
  minPrice: z.coerce.number().finite().nonnegative().default(0),
  maxPrice: z.coerce.number().finite().nonnegative().default(0),
  roomTypeIds: z.string().trim().max(5000).default(''),
  audience: roomAudienceFilterSchema,
  // Compatibility for old shared links. New Search writes roomTypeIds only.
  roomTypes: z.string().trim().max(1000).default(''),
  sort: z.enum([
    'smart', 'nearest', 'distance', 'priceAsc', 'priceDesc', 'updated',
    'updatedAt', 'vacantRoomsCount', 'minPrice', 'code', 'name',
  ]).default('smart'),
  mapSouth: z.coerce.number().finite().min(-90).max(90).optional(),
  mapWest: z.coerce.number().finite().min(-180).max(180).optional(),
  mapNorth: z.coerce.number().finite().min(-90).max(90).optional(),
  mapEast: z.coerce.number().finite().min(-180).max(180).optional(),
  mapPolygon: z.string().max(1800).optional(),
}).superRefine(validateBuildingRegion).superRefine(validateSearchOrigin);

export function validateBuildingRegion(data: { scope: string; mapSouth?: number; mapWest?: number; mapNorth?: number; mapEast?: number; mapPolygon?: string }, context: z.RefinementCtx) {
  const values = [data.mapSouth, data.mapWest, data.mapNorth, data.mapEast];
  const provided = values.filter((value) => value !== undefined).length;
  const polygon = decodeMapPolygon(data.mapPolygon);
  if (data.mapPolygon !== undefined && (!polygon || provided !== 4)) {
    context.addIssue({ code: 'custom', path: ['mapPolygon'], message: 'Vùng vẽ cần 3–32 điểm hợp lệ và đủ bốn biên.' });
  }
  if (provided > 0 && provided < 4) {
    context.addIssue({ code: 'custom', path: ['mapSouth'], message: 'Vùng bản đồ phải có đủ bốn biên.' });
    return;
  }
  if (provided === 4) {
    if (data.scope === 'cms') {
      context.addIssue({ code: 'custom', path: ['mapSouth'], message: 'Khoanh vùng bản đồ chỉ áp dụng cho dữ liệu public.' });
      return;
    }
    const region = publicMapBoundsSchema.safeParse({
      type: 'bounds',
      south: data.mapSouth,
      west: data.mapWest,
      north: data.mapNorth,
      east: data.mapEast,
      ...(polygon ? { polygon } : {}),
    });
    if (!region.success) {
      for (const issue of region.error.issues) {
        context.addIssue({ code: 'custom', path: issue.path.length ? issue.path : ['mapSouth'], message: issue.message });
      }
    }
  }
}

/** Map membership only. Pagination and ordering intentionally have no place here. */
export const publicBuildingMapQuerySchema = z.object({
  ...originQueryFields,
  scope: z.literal('public').default('public'),
  search: buildingListQuerySchema.shape.search,
  ownerType: buildingListQuerySchema.shape.ownerType,
  availability: buildingListQuerySchema.shape.availability,
  location: buildingListQuerySchema.shape.location,
  ward: buildingListQuerySchema.shape.ward,
  universityWard: buildingListQuerySchema.shape.universityWard,
  schoolIds: buildingListQuerySchema.shape.schoolIds,
  nearSchool: buildingListQuerySchema.shape.nearSchool,
  amenityIds: buildingListQuerySchema.shape.amenityIds,
  minPrice: buildingListQuerySchema.shape.minPrice,
  maxPrice: buildingListQuerySchema.shape.maxPrice,
  roomTypeIds: buildingListQuerySchema.shape.roomTypeIds,
  audience: buildingListQuerySchema.shape.audience,
  roomTypes: buildingListQuerySchema.shape.roomTypes,
  mapSouth: buildingListQuerySchema.shape.mapSouth,
  mapWest: buildingListQuerySchema.shape.mapWest,
  mapNorth: buildingListQuerySchema.shape.mapNorth,
  mapEast: buildingListQuerySchema.shape.mapEast,
  mapPolygon: buildingListQuerySchema.shape.mapPolygon,
}).strict().superRefine(validateBuildingRegion).superRefine(validateSearchOrigin);
export type PublicBuildingMapQuery = z.infer<typeof publicBuildingMapQuerySchema>;

export const buildingListItemSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  status: z.string(),
  ownerType: z.string(),
  address: z.string(),
  district: z.string(),
  ward: z.string(),
  city: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  vacantRoomsCount: z.number().int().nonnegative(),
  totalRoomsCount: z.number().int().nonnegative(),
  minPrice: z.number(),
  maxPrice: z.number(),
  coverImage: z.string(),
  images: z.array(z.string()),
  media360: media360ListSchema,
  hostName: z.string(),
  hostPhone: z.string(),
  hostEmail: z.string(),
  hostAddress: z.string(),
  amenityIds: z.array(z.string()),
  ownerId: z.string(),
  createdBy: z.string(),
  allowedViewerIds: z.array(z.string()),
  nearestSchoolId: z.string().nullable().default(null),
  originDistanceKm: z.number().nonnegative().nullable().default(null),
  nearestSchoolName: z.string().nullable().default(null),
  nearestSchoolCampus: z.string().nullable().default(null),
  nearestSchoolDistanceKm: z.number().nonnegative().nullable().default(null),
  nearestSchoolEffectiveRadiusKm: z.number().positive().nullable().default(null),
  nearestSchoolRadiusSource: z.enum(['school', 'default']).nullable().default(null),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).passthrough();

export const buildingPageSchema = pagedResponseSchema(buildingListItemSchema);
export const buildingStatsSchema = z.object({
  active: z.number().int().nonnegative(),
  archived: z.number().int().nonnegative(),
  partner: z.number().int().nonnegative(),
  missingCoordinates: z.number().int().nonnegative(),
});

export const buildingViewPermissionsSchema = z
  .object({
    viewerIds: z
      .array(
        z.union([
          z.string(),
          z.number(),
        ]),
      )
      .default([]),
  })
  .strict();

const coordinatePair = {
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
};

export const buildingWriteSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    code: z.string().trim().max(80).optional(),
    name: z.string().trim().min(1, 'Vui lòng nhập tên tòa nhà.').max(200),
    address: z.string().trim().min(1, 'Vui lòng nhập địa chỉ tòa nhà.').max(500),
    district: z.string().trim().max(160).optional(),
    ward: z.string().trim().max(160).optional(),
    city: z.string().trim().max(160).optional(),
    province: z.string().trim().max(160).optional(),
    ...coordinatePair,
    coverImage: z.string().optional(),
    images: z.array(z.string()).max(25).optional(),
    media360: media360ListSchema.optional(),
    ownerType: z.enum(['tiny', 'partner']).optional(),
    isTiny: z.boolean().optional(),
    amenityIds: z.array(z.string().min(1)).max(200).optional(),
    hostName: z.string().trim().min(1, 'Vui lòng nhập tên chủ nhà/người quản lý.').max(160),
    hostPhone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại chủ nhà/người quản lý.').max(50),
    hostEmail: z.union([z.string().trim().email('Email chủ nhà không hợp lệ.'), z.literal('')]).optional(),
    hostAddress: z.string().trim().min(1, 'Vui lòng nhập địa chỉ chủ nhà.').max(500),
  })
  .strict()
  .superRefine((data, context) => {
    const hasLatitude = data.latitude !== undefined;
    const hasLongitude = data.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: 'custom',
        path: hasLatitude ? ['longitude'] : ['latitude'],
        message: 'Vĩ độ và kinh độ phải được nhập cùng nhau.',
      });
    }
  });

export type BuildingViewPermissions = z.infer<
  typeof buildingViewPermissionsSchema
>;
export type BuildingWrite = z.infer<
  typeof buildingWriteSchema
>;

export type BuildingListQuery = z.infer<typeof buildingListQuerySchema>;
