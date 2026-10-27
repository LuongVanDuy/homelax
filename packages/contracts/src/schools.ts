import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

const EARTH_RADIUS_KM = 6371.0088;
export const DEFAULT_SCHOOL_RADIUS_KM = 3;

export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();

export const SCHOOL_STATUSES = ['active', 'archived'] as const;
export const SCHOOL_LOCATION_FILTERS = [
  'complete',
  'missingCoordinates',
  'missingRadius',
] as const;

export const schoolStatusSchema = z.enum(SCHOOL_STATUSES);
export const schoolLocationFilterSchema = z.enum(SCHOOL_LOCATION_FILTERS);

const schoolWriteBaseSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên trường.').max(220),
  campus: z.string().trim().max(180).default(''),
  address: z.string().trim().min(1, 'Vui lòng nhập địa chỉ trường.').max(320),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  radiusKm: z.number().positive('Bán kính phải lớn hơn 0.').max(100).nullable().default(null),
}).strict();

function validateCoordinatePair(
  value: { latitude: number | null; longitude: number | null },
  context: z.RefinementCtx,
) {
  if ((value.latitude === null) !== (value.longitude === null)) {
    context.addIssue({
      code: 'custom',
      path: ['latitude'],
      message: 'Vĩ độ và kinh độ phải được nhập cùng nhau.',
    });
    context.addIssue({
      code: 'custom',
      path: ['longitude'],
      message: 'Vĩ độ và kinh độ phải được nhập cùng nhau.',
    });
  }
}

export const schoolWriteSchema = schoolWriteBaseSchema.superRefine(
  validateCoordinatePair,
);

export const schoolSchema = schoolWriteBaseSchema.extend({
  id: z.string().min(1),
  shortName: z.string(),
  type: z.string(),
  sector: z.string(),
  ward: z.string(),
  keywords: z.array(z.string()),
  status: schoolStatusSchema,
  source: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).strict().superRefine(validateCoordinatePair);

export const schoolListQuerySchema = listQueryBaseSchema.extend({
  status: z.union([schoolStatusSchema, z.literal('')]).default(''),
  location: z.union([schoolLocationFilterSchema, z.literal('')]).default(''),
  sort: z.enum(['name', 'updatedAt', 'radiusKm', 'createdAt']).default('name'),
});

export const schoolPageSchema = pagedResponseSchema(schoolSchema);

export const schoolRadiusSourceSchema = z.enum(['school', 'default']);

export const publicSchoolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  campus: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().positive().max(100).nullable(),
  effectiveRadiusKm: z.number().positive().max(100),
  radiusSource: schoolRadiusSourceSchema,
  status: z.literal('active'),
  availableUnitCount: z.number().int().nonnegative(),
}).strict();

export const publicSchoolListQuerySchema = listQueryBaseSchema.extend({
  ids: z.string().trim().max(5000).default(''),
  id: z.string().trim().max(200).optional(),
  sort: z.enum(['name', 'campus', 'availableUnitCount']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
}).strict();

export const publicSchoolPageSchema = pagedResponseSchema(publicSchoolSchema).strict();

export const schoolBuildingDistanceSchema = z.object({
  buildingId: z.string().min(1),
  buildingCode: z.string(),
  buildingName: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  distanceKm: z.number().nonnegative(),
  effectiveRadiusKm: z.number().positive(),
  radiusSource: schoolRadiusSourceSchema,
  withinRadius: z.boolean(),
}).strict();

export const schoolDistanceResultSchema = z.object({
  method: z.literal('haversine'),
  unit: z.literal('km'),
  defaultRadiusKm: z.number().positive(),
  effectiveRadiusKm: z.number().positive(),
  radiusSource: schoolRadiusSourceSchema,
  school: schoolSchema,
  buildings: z.array(schoolBuildingDistanceSchema),
}).strict();

export function effectiveSchoolRadiusKm(radiusKm: number | null | undefined) {
  return radiusKm && radiusKm > 0 ? radiusKm : DEFAULT_SCHOOL_RADIUS_KM;
}

export function haversineDistanceKm(
  from: z.infer<typeof geoPointSchema>,
  to: z.infer<typeof geoPointSchema>,
) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLong = radians(to.longitude - from.longitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLong / 2) ** 2;
  const distance = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
  return Math.round(distance * 1000) / 1000;
}

export type SchoolStatus = z.infer<typeof schoolStatusSchema>;
export type SchoolLocationFilter = z.infer<typeof schoolLocationFilterSchema>;
export type SchoolWrite = z.infer<typeof schoolWriteSchema>;
export type School = z.infer<typeof schoolSchema>;
export type SchoolListQuery = z.infer<typeof schoolListQuerySchema>;
export type SchoolRadiusSource = z.infer<typeof schoolRadiusSourceSchema>;
export type SchoolBuildingDistance = z.infer<typeof schoolBuildingDistanceSchema>;
export type SchoolDistanceResult = z.infer<typeof schoolDistanceResultSchema>;
export type PublicSchool = z.infer<typeof publicSchoolSchema>;
export type PublicSchoolListQuery = z.infer<typeof publicSchoolListQuerySchema>;
