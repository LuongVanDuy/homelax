import { z } from 'zod';
import { appIdentitySchema } from './auth.js';
import { userSummarySchema } from './users.js';
import { pagedResponseSchema } from './list.js';

export const accountPermissionsSchema = appIdentitySchema.pick({
  allowedScreens: true,
  bookingScope: true,
  bookingCanAssign: true,
  bookingCanReassign: true,
  bookingCanTransition: true,
  bookingCanCancel: true,
  bookingCanReschedule: true,
  dealScope: true,
  dealCanCreate: true,
  dealCanCreateDirect: true,
  dealCanManageContractDeposit: true,
  dealCanManageRentalSchedule: true,
  dealCanManageLifecycle: true,
});

// Personal fields are deliberately not added to list/session identity payloads.
export const accountUserSchema = userSummarySchema.extend({
  gender: z.enum(['male', 'female', 'other']).nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  address: z.string(),
  emailVerifiedAt: z.string().datetime().nullable().optional(),
});

export const accountDetailSchema = z.object({
  user: accountUserSchema,
  permissions: accountPermissionsSchema,
  security: z.object({
    passwordSet: z.boolean(),
    activeRefreshSessions: z.number().int().nonnegative(),
    lastRefreshAt: z.string().nullable(),
  }).strict(),
}).strict();

export const accountRelatedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).strict();

export const accountLinkedProfileSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['customer', 'collaborator']),
  name: z.string(),
  archivedAt: z.string().nullable(),
}).strict();
export const accountLinkedProfilesPageSchema = pagedResponseSchema(accountLinkedProfileSchema);

// Never expose raw audit metadata through the account detail endpoint.
export const accountActivityItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  summary: z.string(),
  createdAt: z.string().nullable(),
}).strict();
export const accountActivityPageSchema = pagedResponseSchema(accountActivityItemSchema).extend({
  retentionDays: z.number().int().positive(),
});
export const accountProfileResultSchema = z.object({
  success: z.literal(true),
  user: appIdentitySchema,
});
export const accountPasswordResultSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type AccountUser = z.infer<typeof accountUserSchema>;
export type AccountDetail = z.infer<typeof accountDetailSchema>;
export type AccountRelatedQuery = z.infer<typeof accountRelatedQuerySchema>;
export type AccountLinkedProfile = z.infer<typeof accountLinkedProfileSchema>;
export type AccountActivityItem = z.infer<typeof accountActivityItemSchema>;
