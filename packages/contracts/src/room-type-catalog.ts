import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const DEFAULT_ROOM_TYPE_CATALOG = [
  { id: 'RTC-PHONG-DON', code: 'phong-don', name: 'Phòng đơn', sortOrder: 10 },
  { id: 'RTC-STUDIO', code: 'studio', name: 'Studio', sortOrder: 20 },
  { id: 'RTC-1N1K', code: '1n1k', name: '1N1K', sortOrder: 30 },
  { id: 'RTC-2N1K', code: '2n1k', name: '2N1K', sortOrder: 40 },
  { id: 'RTC-3N1K', code: '3n1k', name: '3N1K', sortOrder: 50 },
  { id: 'RTC-HOMESTAY', code: 'homestay', name: 'Homestay', sortOrder: 70 },
  { id: 'RTC-NHA-NGUYEN-CAN', code: 'nha-nguyen-can', name: 'Nhà nguyên căn', sortOrder: 80 },
  { id: 'RTC-MAT-BANG-KINH-DOANH', code: 'mat-bang-kinh-doanh', name: 'Mặt bằng kinh doanh', sortOrder: 90 },
] as const;

export const roomTypeCatalogStatusSchema = z.enum(['active', 'archived']);

export const roomTypeCatalogWriteSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên loại phòng.').max(160),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

export const roomTypeCatalogSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  status: roomTypeCatalogStatusSchema,
  sortOrder: z.number().int().nonnegative(),
  source: z.string(),
  assignmentCount: z.number().int().nonnegative(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).strict();

export const roomTypeCatalogListQuerySchema = listQueryBaseSchema.extend({
  status: z.enum(['', 'active', 'archived']).default(''),
  ids: z.string().trim().max(5000).default(''),
  sort: z.enum(['sortOrder', 'name', 'assignmentCount', 'updatedAt']).default('sortOrder'),
}).strict();

export const roomTypeCatalogPageSchema = pagedResponseSchema(roomTypeCatalogSchema).strict();

export const publicRoomTypeCatalogSchema = roomTypeCatalogSchema.pick({
  id: true,
  name: true,
  sortOrder: true,
  status: true,
}).extend({
  status: z.literal('active'),
}).strict();

export const publicRoomTypeCatalogListQuerySchema = listQueryBaseSchema.extend({
  ids: z.string().trim().max(5000).default(''),
  sort: z.enum(['sortOrder', 'name']).default('sortOrder'),
}).strict();

export const publicRoomTypeCatalogPageSchema = pagedResponseSchema(publicRoomTypeCatalogSchema).strict();

export type RoomTypeCatalogWrite = z.infer<typeof roomTypeCatalogWriteSchema>;
export type RoomTypeCatalog = z.infer<typeof roomTypeCatalogSchema>;
export type RoomTypeCatalogListQuery = z.infer<typeof roomTypeCatalogListQuerySchema>;
export type PublicRoomTypeCatalog = z.infer<typeof publicRoomTypeCatalogSchema>;
export type PublicRoomTypeCatalogListQuery = z.infer<typeof publicRoomTypeCatalogListQuerySchema>;

export function defaultRoomTypeCatalogIdByLegacyName(name: string) {
  const normalized = String(name || '').trim().toLocaleLowerCase('vi');
  return DEFAULT_ROOM_TYPE_CATALOG.find(item => item.name.toLocaleLowerCase('vi') === normalized)?.id || null;
}
