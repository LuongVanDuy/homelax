import { z } from 'zod';
import { affiliateTokenSchema } from './affiliate.js';

export const commissionConfigBoundarySchema = z.object({
  requirementId: z.literal('F091_QA04_A03'),
  formula: z.literal('gross_x_minus_10_percent_then_allocate_net_pool'),
  taxRatePercent: z.literal(10),
  allocationPoolPercent: z.literal(90),
  totalAllocationPercentRequired: z.literal(100),
  ctvBonusTreatment: z.literal('add_after_base_no_tax'),
  legacyRoomUnitContractAmounts: z.literal('retired_a03_preserved_history'),
  commissionLedgerAvailable: z.literal(true),
}).strict();

export const COMMISSION_CONFIG_BOUNDARY = commissionConfigBoundarySchema.parse({
  requirementId: 'F091_QA04_A03',
  formula: 'gross_x_minus_10_percent_then_allocate_net_pool',
  taxRatePercent: 10,
  allocationPoolPercent: 90,
  totalAllocationPercentRequired: 100,
  ctvBonusTreatment: 'add_after_base_no_tax',
  legacyRoomUnitContractAmounts: 'retired_a03_preserved_history',
  commissionLedgerAvailable: true,
});

export const collaboratorTypeWriteSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên loại CTV.').max(120),
  description: z.string().trim().max(1000).optional().default(''),
}).strict();

export const collaboratorTypeSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const collaboratorTypeListSchema = z.array(collaboratorTypeSummarySchema);

export const commissionCollaboratorSummarySchema = z.object({
  id: z.string().min(1),
  userId: z.string().nullable(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  affiliateToken: affiliateTokenSchema.nullable(),
  collaboratorTypeId: z.string().nullable(),
  collaboratorTypeName: z.string(),
}).strict();

export const commissionCollaboratorListSchema = z.array(commissionCollaboratorSummarySchema);

export const collaboratorTypeAssignmentSchema = z.object({
  collaboratorTypeId: z.string().trim().min(1).nullable(),
}).strict();

export const COMMISSION_ALLOCATION_TARGET_KINDS = ['department', 'position'] as const;
export const commissionAllocationTargetKindSchema = z.enum(COMMISSION_ALLOCATION_TARGET_KINDS);

export const commissionAllocationTargetWriteSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên phòng ban/vị trí.').max(160),
  targetKind: commissionAllocationTargetKindSchema,
  percentage: z.number().finite().min(0).max(100),
  isCtv: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().trim().max(2000).optional().default(''),
}).strict();

export const commissionAllocationTargetSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  targetKind: commissionAllocationTargetKindSchema,
  percentage: z.number().min(0).max(100),
  isCtv: z.boolean(),
  isActive: z.boolean(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const commissionAllocationTargetListSchema = z.array(commissionAllocationTargetSummarySchema);

export const commissionAllocationStatusSchema = z.object({
  activePercentageTotal: z.number().min(0),
  remainingPercentage: z.number(),
  activeTargetCount: z.number().int().nonnegative(),
  activeCtvTargetCount: z.number().int().nonnegative(),
  ctvTargetId: z.string().nullable(),
  ctvTargetName: z.string(),
  readyForCalculation: z.boolean(),
}).strict();

export type CollaboratorTypeWrite = z.infer<typeof collaboratorTypeWriteSchema>;
export type CollaboratorTypeSummary = z.infer<typeof collaboratorTypeSummarySchema>;
export type CollaboratorTypeAssignment = z.infer<typeof collaboratorTypeAssignmentSchema>;
export type CommissionAllocationTargetWrite = z.infer<typeof commissionAllocationTargetWriteSchema>;
export type CommissionAllocationTargetSummary = z.infer<typeof commissionAllocationTargetSummarySchema>;
export type CommissionAllocationStatus = z.infer<typeof commissionAllocationStatusSchema>;
