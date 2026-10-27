import { z } from 'zod';
import { pagedResponseSchema } from './list.js';
import { publicRoomTypeSchema } from './public-inventory.js';

export const selfPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
}).strict();
export type SelfPageQuery = z.infer<typeof selfPageQuerySchema>;
export const favoriteStateSchema = z.object({ saved: z.boolean() }).strict();
export const favoriteSchema = z.object({
  unitId: z.string(), savedAt: z.string(),
  room: publicRoomTypeSchema.nullable(),
}).strict();
export const favoritePageSchema = pagedResponseSchema(favoriteSchema);
export const selfRentalSchema = z.object({
  id: z.string(), roomUnitId: z.string(), roomUnitCode: z.string(),
  roomTypeId: z.string(), roomTypeName: z.string(),
  buildingId: z.string(), buildingCode: z.string(), buildingName: z.string(),
  finalPrice: z.number(), contractMonths: z.number().nullable(),
  rentalStartDate: z.string().nullable(), rentalEndDate: z.string().nullable(),
  lifecycleStatus: z.enum(['active', 'cancelled']),
  contractSignedAt: z.string().nullable(),
  depositRequiredAmount: z.number().nullable(), depositPaidAmount: z.number(),
}).strict();
export const selfRentalPageSchema = pagedResponseSchema(selfRentalSchema);
export type SelfRental = z.infer<typeof selfRentalSchema>;
