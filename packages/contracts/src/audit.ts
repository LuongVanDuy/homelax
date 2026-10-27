import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const auditSummarySchema = z.object({
  id: z.string().min(1),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  summary: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().nullable(),
}).passthrough();

export const auditListQuerySchema = listQueryBaseSchema.extend({
  action: z.string().trim().max(80).default(''),
  entityType: z.string().trim().max(80).default(''),
  sort: z.enum(['createdAt']).default('createdAt'),
});
export const auditPageSchema = pagedResponseSchema(auditSummarySchema).extend({
  retentionDays: z.number().int().positive(),
});
export type AuditSummary = z.infer<typeof auditSummarySchema>;
export type AuditPage = z.infer<typeof auditPageSchema>;

export const auditCreateRequestSchema = z
  .object({
    action: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    summary: z
      .string()
      .trim()
      .min(
        1,
        'Mô tả tóm tắt không được để trống.',
      ),
    metadata: z
      .record(z.string(), z.unknown())
      .optional(),
  })
  .strict();

export type AuditCreateRequest = z.infer<
  typeof auditCreateRequestSchema
>;

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
