import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const AMENITY_SCOPES = ['building', 'room'] as const;
export const AMENITY_STATUSES = ['active', 'archived'] as const;
export const AMENITY_CATEGORIES = [
  'building_common',
  'building_security',
  'building_fire_safety',
  'building_other',
  'room_furniture',
  'room_electrical',
  'room_other',
  'room_fire_safety',
] as const;

export const amenityScopeSchema = z.enum(AMENITY_SCOPES);
export const amenityStatusSchema = z.enum(AMENITY_STATUSES);
export const amenityCategorySchema = z.enum(AMENITY_CATEGORIES);

export const amenityWriteSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên tiện ích.').max(160),
  scope: amenityScopeSchema,
  category: amenityCategorySchema,
  sortOrder: z.number().int().min(0).max(100000).default(0),
}).strict().superRefine((value, context) => {
  if (!value.category.startsWith(value.scope + '_')) {
    context.addIssue({
      code: 'custom',
      path: ['category'],
      message: 'Nhóm tiện ích không thuộc đúng phạm vi.',
    });
  }
});

export const amenitySchema = amenityWriteSchema.extend({
  id: z.string().min(1),
  code: z.string().min(1),
  status: amenityStatusSchema,
  source: z.string(),
  assignmentCount: z.number().int().nonnegative(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).strict();

export const amenityListQuerySchema = listQueryBaseSchema.extend({
  scope: z.union([amenityScopeSchema, z.literal('')]).default(''),
  status: z.union([amenityStatusSchema, z.literal('')]).default(''),
  category: z.union([amenityCategorySchema, z.literal('')]).default(''),
  ids: z.string().trim().max(5000).default(''),
  sort: z.enum(['sortOrder', 'name', 'assignmentCount', 'createdAt']).default('sortOrder'),
});
export const amenityPageSchema = pagedResponseSchema(amenitySchema);

export const publicAmenitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: amenityScopeSchema,
  category: amenityCategorySchema,
  sortOrder: z.number().int().nonnegative(),
  status: z.literal('active'),
}).strict();

export const publicAmenityListQuerySchema = listQueryBaseSchema.extend({
  ids: z.string().trim().max(5000).default(''),
  scope: z.union([amenityScopeSchema, z.literal('')]).default(''),
  category: z.union([amenityCategorySchema, z.literal('')]).default(''),
  sort: z.enum(['sortOrder', 'name']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
}).strict();

export const publicAmenityPageSchema = pagedResponseSchema(publicAmenitySchema).strict();

export const amenityAssignmentSchema = z.object({
  amenityIds: z.array(z.string().min(1)).max(200).refine(
    (values) => new Set(values).size === values.length,
    'Danh sách tiện ích bị trùng.',
  ),
}).strict();

export type AmenityScope = z.infer<typeof amenityScopeSchema>;
export type AmenityStatus = z.infer<typeof amenityStatusSchema>;
export type AmenityCategory = z.infer<typeof amenityCategorySchema>;
export type AmenityWrite = z.infer<typeof amenityWriteSchema>;
export type Amenity = z.infer<typeof amenitySchema>;
export type AmenityAssignment = z.infer<typeof amenityAssignmentSchema>;

export type AmenityListQuery = z.infer<typeof amenityListQuerySchema>;
export type PublicAmenity = z.infer<typeof publicAmenitySchema>;
export type PublicAmenityListQuery = z.infer<typeof publicAmenityListQuerySchema>;
