import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';
import { normalizeAccountPhone, profilePhoneSchema } from './profile.js';

export const intakeKindSchema = z.enum(['landlord_consultation', 'collaborator_registration', 'collaborator_consultation', 'general_contact']);
export const intakeStatusSchema = z.enum(['new', 'processing', 'completed', 'rejected', 'spam']);
export const intakeCreateSchema = z.object({
  requestKey: z.uuid(),
  kind: intakeKindSchema,
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(160),
  phone: profilePhoneSchema.refine(value => normalizeAccountPhone(value).length >= 6, 'Vui lòng nhập số điện thoại hợp lệ.'),
  need: z.string().trim().max(4000).default(''),
}).strict();
export const intakeReceiptSchema = z.object({ success: z.literal(true), receiptId: z.uuid() }).strict();
export const intakeSummarySchema = z.object({
  id: z.uuid(), kind: intakeKindSchema, name: z.string(), phone: z.string(), need: z.string(),
  status: intakeStatusSchema, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  revision: z.number().int().nonnegative(),
}).strict();
export const intakeListQuerySchema = listQueryBaseSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  kind: intakeKindSchema.optional(), status: intakeStatusSchema.optional(),
}).strict();
export const intakePageSchema = pagedResponseSchema(intakeSummarySchema);
export type IntakeCreate = z.infer<typeof intakeCreateSchema>;
export type IntakeListQuery = z.infer<typeof intakeListQuerySchema>;
export type IntakeSummary = z.infer<typeof intakeSummarySchema>;
export type IntakeStatus = z.infer<typeof intakeStatusSchema>;
export const intakeTransitions: Record<IntakeStatus, readonly IntakeStatus[]> = {
  new: ['processing', 'rejected', 'spam'], processing: ['completed', 'rejected', 'spam'], completed: [], rejected: [], spam: [],
};
export const intakeUpdateSchema = z.object({
  status: intakeStatusSchema,
  note: z.string().trim().max(4000).default(''),
  expectedRevision: z.number().int().nonnegative(),
}).strict();
export type IntakeUpdate = z.infer<typeof intakeUpdateSchema>;
export const intakeHistorySchema = z.object({
  id: z.uuid(), actorName: z.string(), fromStatus: intakeStatusSchema, toStatus: intakeStatusSchema,
  note: z.string(), createdAt: z.iso.datetime(), revision: z.number().int().positive(),
}).strict();
export const intakeHistoryPageSchema = pagedResponseSchema(intakeHistorySchema);
export const intakeHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).strict();
