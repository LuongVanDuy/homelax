import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const contactArchiveFilterSchema = z.enum(['active', 'archived', 'all']);

export const contactListQuerySchema = listQueryBaseSchema.extend({
  archived: contactArchiveFilterSchema.default('active'),
  sort: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
});

const contactSummaryFields = {
  id: z.string().min(1),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  notes: z.string(),
  userId: z.string().nullable(),
  bookingIds: z.array(z.string()),
  dealIds: z.array(z.string()),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const customerSummarySchema = z.object({
  ...contactSummaryFields,
  age: z.number().int().nonnegative().nullable(),
  ageRecordedAt: z.iso.date().nullable(),
  sourceType: z.string(),
  sourceChannel: z.string(),
  referredByCollaboratorId: z.string().nullable(),
  sourceRecordedAt: z.string().nullable(),
});

export const collaboratorSummarySchema = z.object(contactSummaryFields);
export const customerPageSchema = pagedResponseSchema(customerSummarySchema);
export const collaboratorPageSchema = pagedResponseSchema(collaboratorSummarySchema);

const contactWriteFields = {
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(160),
  phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại.').max(50),
  email: z.string().trim().max(254)
    .pipe(z.union([z.string().email('Email không hợp lệ.'), z.literal('')])).optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(4000).optional(),
  // U03 only links records explicitly; email/phone never auto-attach history.
  userId: z.string().trim().max(200).nullable().optional(),
  bookingIds: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
};

export const customerSourceTypeSchema = z.enum(['website', 'ctv', 'ads', 'social', 'other']);

export const customerWriteSchema = z.object({
  ...contactWriteFields,
  // PostgreSQL INTEGER storage bound, not an age eligibility restriction.
  age: z.number().int('Tuổi phải là số nguyên.').nonnegative('Tuổi không được âm.')
    .max(2_147_483_647, 'Tuổi vượt giới hạn lưu trữ.').nullable().optional(),
  sourceType: customerSourceTypeSchema.optional(),
  sourceChannel: z.string().trim().max(120).optional(),
  referredByCollaboratorId: z.string().trim().max(200).nullable().optional(),
}).strict();

export const collaboratorWriteSchema = z.object(contactWriteFields).strict();

export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
export type ContactArchiveFilter = z.infer<typeof contactArchiveFilterSchema>;
export type CustomerSummary = z.infer<typeof customerSummarySchema>;
export type CollaboratorSummary = z.infer<typeof collaboratorSummarySchema>;
export type CustomerWrite = z.infer<typeof customerWriteSchema>;
export type CollaboratorWrite = z.infer<typeof collaboratorWriteSchema>;
