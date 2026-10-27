import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';
import { media360ListSchema } from './media.js';
import { roomAudienceGroupsSchema } from './room-audiences.js';

export const ROOM_UNIT_STATUSES = [
  'available',
  'occupied',
  'maintenance',
  'archived',
] as const;

export const ROOM_TYPE_LIFECYCLE_STATUSES = [
  'active',
  'archived',
] as const;

export const roomUnitStatusSchema = z.enum(ROOM_UNIT_STATUSES);
export const roomTypeLifecycleStatusSchema = z.enum(ROOM_TYPE_LIFECYCLE_STATUSES);

const optionalDate = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có định dạng YYYY-MM-DD.'),
    z.null(),
  ])
  .optional();

export const roomUnitWriteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập mã căn.')
    .max(20, 'Mã căn tối đa 20 ký tự.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Mã căn chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới hoặc /.'),
  status: roomUnitStatusSchema.default('available'),
  availableFrom: optionalDate,
}).strict();

export const roomUnitSchema = roomUnitWriteSchema.extend({
  id: z.string().min(1),
  roomTypeId: z.string().min(1),
  buildingId: z.string().min(1),
  migrationSource: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).strict();

export const roomTypeWriteSchema = z
  .object({
    buildingId: z.string().trim().optional(),
    buildingCode: z.string().trim().optional(),
    roomTypeCatalogId: z.string().trim().min(1, 'Vui lòng chọn loại phòng.'),
    price: z.number().finite().nonnegative(),
    area: z.number().finite().positive(),
    maxOccupants: z.number().int().positive(),
    coverImage: z.string().trim().optional(),
    images: z.array(z.string()).max(25),
    media360: media360ListSchema.default([]),
    description: z.string().max(10000),
    amenityIds: z.array(z.string().min(1)).max(200).optional(),
    audienceGroups: roomAudienceGroupsSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Boolean(data.buildingId || data.buildingCode),
    { message: 'Loại phòng phải thuộc một tòa nhà.' },
  );

export const roomListQuerySchema = listQueryBaseSchema.extend({
  scope: z.enum(['public', 'cms']).default('public'),
  lifecycleStatus: z.enum(['', 'active', 'archived']).default(''),
  building: z.string().trim().max(200).default(''),
  availability: z.enum(['', 'available', 'full', 'empty']).default(''),
  sort: z.enum(['updatedAt', 'type', 'price', 'vacantCount']).default('updatedAt'),
});

export const roomTypeSchema = z.object({
  id: z.string().min(1),
  roomTypeId: z.string().min(1),
  buildingId: z.string(),
  buildingCode: z.string(),
  buildingName: z.string(),
  lifecycleStatus: roomTypeLifecycleStatusSchema,
  status: z.string(),
  price: z.number(),
  type: z.string(),
  roomTypeCatalogId: z.string().min(1),
  roomTypeCatalogName: z.string().min(1),
  roomTypeCatalogStatus: z.enum(['active', 'archived']),
  area: z.number(),
  maxOccupants: z.number(),
  coverImage: z.string(),
  images: z.array(z.string()),
  media360: media360ListSchema,
  description: z.string(),
  amenityIds: z.array(z.string()),
  audienceGroups: roomAudienceGroupsSchema.default([]),
  roomUnits: z.array(roomUnitSchema),
  totalUnits: z.number().int().nonnegative(),
  vacantCount: z.number().int().nonnegative(),
  nextAvailableFrom: z.string().nullable(),
}).passthrough();

export const roomPageSchema = pagedResponseSchema(roomTypeSchema);
export const roomStatsSchema = z.object({
  activeTypes: z.number().int().nonnegative(),
  archivedTypes: z.number().int().nonnegative(),
  totalUnits: z.number().int().nonnegative(),
  vacantUnits: z.number().int().nonnegative(),
});

export type RoomUnitStatus = z.infer<typeof roomUnitStatusSchema>;
export type RoomTypeLifecycleStatus = z.infer<typeof roomTypeLifecycleStatusSchema>;
export type RoomUnitWrite = z.infer<typeof roomUnitWriteSchema>;
export type RoomUnit = z.infer<typeof roomUnitSchema>;
export type RoomTypeWrite = z.infer<typeof roomTypeWriteSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type RoomListQuery = z.infer<typeof roomListQuerySchema>;
