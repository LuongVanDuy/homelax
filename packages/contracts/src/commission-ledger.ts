import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const COMMISSION_LEDGER_STATUSES = [
  'blocked_no_collaborator',
  'blocked_no_collaborator_type',
  'blocked_no_policy',
  'eligible_pending_amount',
] as const;

export const commissionLedgerStatusSchema = z.enum(COMMISSION_LEDGER_STATUSES);
export const commissionPaymentStatusSchema = z.enum(['unpaid', 'paid']);

export const COMMISSION_PAYOUT_TIMEZONE = 'Asia/Ho_Chi_Minh' as const;
export const COMMISSION_PAYOUT_CYCLE_DAYS = [1, 15] as const;

export function commissionVietnamDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid payout date.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: COMMISSION_PAYOUT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function commissionPayoutCycleDateForReadyAt(value: Date | string) {
  const localDate = commissionVietnamDate(value);
  const [yearText, monthText, dayText] = localDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (day === 1 || day === 15) return localDate;
  if (day < 15) return `${yearText}-${monthText}-15`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

export const commissionPayoutBoundarySchema = z.object({
  requirementIds: z.tuple([z.literal('F094'), z.literal('QA03')]),
  source: z.literal('commission_ledger_entries'),
  approvalWorkflow: z.literal('admin_and_commission_accountant_dual_approval'),
  approvalOrder: z.literal('any_order_both_required'),
  payoutCycleDays: z.tuple([z.literal(1), z.literal(15)]),
  payoutTimezone: z.literal('Asia/Ho_Chi_Minh'),
  cycleAssignment: z.literal('ready_day_1_or_15_same_day_else_next_cycle'),
  withdrawalRequirement: z.literal('optional_compatibility_not_required'),
  withdrawalRequestUnit: z.literal('one_commission_ledger_entry'),
  requestRequires: z.literal('resolved_amount_review_clear_unpaid'),
  paymentMarking: z.literal('admin_manual_external_confirmation_after_dual_approval_cycle_due'),
  paymentExecution: z.literal('external_out_of_system'),
  minimumWithdrawal: z.literal('pending_d05'),
  paymentEvidence: z.literal('pending_d05'),
  partialPayout: z.literal('pending_d05'),
  paidReversal: z.literal('no_normal_reopen_pending_d05'),
}).strict();

export const COMMISSION_PAYOUT_BOUNDARY = commissionPayoutBoundarySchema.parse({
  requirementIds: ['F094', 'QA03'],
  source: 'commission_ledger_entries',
  approvalWorkflow: 'admin_and_commission_accountant_dual_approval',
  approvalOrder: 'any_order_both_required',
  payoutCycleDays: [1, 15],
  payoutTimezone: COMMISSION_PAYOUT_TIMEZONE,
  cycleAssignment: 'ready_day_1_or_15_same_day_else_next_cycle',
  withdrawalRequirement: 'optional_compatibility_not_required',
  withdrawalRequestUnit: 'one_commission_ledger_entry',
  requestRequires: 'resolved_amount_review_clear_unpaid',
  paymentMarking: 'admin_manual_external_confirmation_after_dual_approval_cycle_due',
  paymentExecution: 'external_out_of_system',
  minimumWithdrawal: 'pending_d05',
  paymentEvidence: 'pending_d05',
  partialPayout: 'pending_d05',
  paidReversal: 'no_normal_reopen_pending_d05',
});

export const commissionLedgerBoundarySchema = z.object({
  requirementIds: z.tuple([z.literal('F097'), z.literal('F098'), z.literal('QA03')]),
  eligibilitySource: z.literal('deal_contract_deposit_complete'),
  idempotencyKey: z.literal('deal_id'),
  calculationSource: z.literal('admin_gross_commission_x'),
  taxRatePercent: z.literal(10),
  allocationPoolPercent: z.literal(90),
  allocationConfig: z.literal('active_targets_total_100_single_ctv'),
  bonusTreatment: z.literal('ctv_bonus_add_after_base_no_tax'),
  exceptionResolution: z.object({
    triggerReviewReasons: z.tuple([
      z.literal('deal_cancelled'),
      z.literal('contract_deposit_completion_reversed'),
    ]),
    allocationRule: z.literal('reuse_existing_snapshot_else_current_config'),
    payoutLock: z.literal('block_withdrawal_requested_or_paid'),
    paidRecovery: z.literal('pending_d05'),
  }).strict(),
  autoReversal: z.literal(false),
}).strict();

export const COMMISSION_LEDGER_BOUNDARY = commissionLedgerBoundarySchema.parse({
  requirementIds: ['F097', 'F098', 'QA03'],
  eligibilitySource: 'deal_contract_deposit_complete',
  idempotencyKey: 'deal_id',
  calculationSource: 'admin_gross_commission_x',
  taxRatePercent: 10,
  allocationPoolPercent: 90,
  allocationConfig: 'active_targets_total_100_single_ctv',
  bonusTreatment: 'ctv_bonus_add_after_base_no_tax',
  exceptionResolution: {
    triggerReviewReasons: ['deal_cancelled', 'contract_deposit_completion_reversed'],
    allocationRule: 'reuse_existing_snapshot_else_current_config',
    payoutLock: 'block_withdrawal_requested_or_paid',
    paidRecovery: 'pending_d05',
  },
  autoReversal: false,
});

export const commissionCalculationRequestSchema = z.object({
  grossCommissionX: z.number().finite().nonnegative(),
  ctvBonus: z.number().finite().nonnegative().default(0),
}).strict();

export const commissionExceptionResolutionRequestSchema = z.object({
  grossCommissionX: z.number().finite().nonnegative(),
  ctvBonus: z.number().finite().nonnegative().default(0),
  reason: z.string().trim().min(1, 'Vui lòng nhập lý do xử lý case.').max(2000),
}).strict();

export const commissionAllocationSnapshotItemSchema = z.object({
  targetId: z.string().min(1),
  targetName: z.string(),
  targetKind: z.enum(['department', 'position']),
  percentage: z.number().min(0).max(100),
  amount: z.number().nonnegative(),
  isCtv: z.boolean(),
}).strict();

export const commissionCalculationFactsSchema = z.object({
  grossCommissionX: z.number().nonnegative(),
  taxRateSnapshot: z.number().min(0).max(100),
  taxAmount: z.number().nonnegative(),
  allocationPool: z.number().nonnegative(),
  allocationSnapshot: z.array(commissionAllocationSnapshotItemSchema),
  ctvAllocationTargetId: z.string().min(1),
  ctvAllocationTargetNameSnapshot: z.string(),
  ctvPercentageSnapshot: z.number().min(0).max(100),
  ctvBaseAmount: z.number().nonnegative(),
  ctvBonusAmount: z.number().nonnegative(),
  commissionAmount: z.number().nonnegative(),
}).strict();

export const commissionExceptionResolutionHistoryItemSchema = z.object({
  sequence: z.number().int().positive(),
  sourceReviewReason: z.string(),
  resolutionReason: z.string().min(1),
  allocationSource: z.enum(['previous_snapshot', 'current_config']),
  resolvedAt: z.string(),
  resolvedByUserId: z.string().min(1),
  before: commissionCalculationFactsSchema.nullable(),
  after: commissionCalculationFactsSchema,
}).strict();

export const commissionLedgerSummarySchema = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  customerId: z.string().min(1),
  collaboratorId: z.string().nullable(),
  collaboratorNameSnapshot: z.string(),
  collaboratorTypeId: z.string().nullable(),
  collaboratorTypeNameSnapshot: z.string(),
  roomUnitId: z.string().min(1),
  roomUnitCodeSnapshot: z.string(),
  finalPriceSnapshot: z.number().nonnegative(),
  sourceTypeSnapshot: z.string(),
  sourceChannelSnapshot: z.string(),
  sourceRecordedAtSnapshot: z.string().nullable(),
  grossCommissionX: z.number().nonnegative().nullable(),
  taxRateSnapshot: z.number().min(0).max(100).nullable(),
  taxAmount: z.number().nonnegative().nullable(),
  allocationPool: z.number().nonnegative().nullable(),
  allocationSnapshot: z.array(commissionAllocationSnapshotItemSchema),
  ctvAllocationTargetId: z.string().nullable(),
  ctvAllocationTargetNameSnapshot: z.string(),
  ctvPercentageSnapshot: z.number().min(0).max(100).nullable(),
  ctvBaseAmount: z.number().nonnegative().nullable(),
  ctvBonusAmount: z.number().nonnegative().nullable(),
  commissionAmount: z.number().nonnegative().nullable(),
  calculatedAt: z.string().nullable(),
  calculatedByUserId: z.string().nullable(),
  exceptionResolutionCount: z.number().int().nonnegative(),
  exceptionResolutionReason: z.string(),
  exceptionAllocationSource: z.enum(['', 'previous_snapshot', 'current_config']),
  exceptionResolvedAt: z.string().nullable(),
  exceptionResolvedByUserId: z.string().nullable(),
  exceptionResolutionHistory: z.array(commissionExceptionResolutionHistoryItemSchema),
  status: commissionLedgerStatusSchema,
  paymentStatus: commissionPaymentStatusSchema,
  adminApprovedAt: z.string().nullable(),
  adminApprovedByUserId: z.string().nullable(),
  accountantApprovedAt: z.string().nullable(),
  accountantApprovedByUserId: z.string().nullable(),
  dualApprovalComplete: z.boolean(),
  payoutReadyAt: z.string().nullable(),
  payoutCycleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  payoutDue: z.boolean(),
  withdrawalRequestedAt: z.string().nullable(),
  withdrawalRequestedByUserId: z.string().nullable(),
  paidAt: z.string().nullable(),
  paidByUserId: z.string().nullable(),
  reviewRequired: z.boolean(),
  reviewReason: z.string(),
  eligibleAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const commissionLedgerNullableSchema = commissionLedgerSummarySchema.nullable();

export const commissionHistoryBoundarySchema = z.object({
  requirementIds: z.tuple([z.literal('F092'), z.literal('F093'), z.literal('QA03')]),
  source: z.literal('commission_ledger_entries'),
  scope: z.literal('admin_accountant_all_ctv_self'),
  rawEventTimestamp: z.literal('eligible_at'),
  historyAvailable: z.literal(true),
  monthlyStatement: z.object({
    enabled: z.literal(true),
    status: z.literal('canonical_d09'),
    monthAxis: z.literal('eligible_at_first_contract_deposit_complete'),
    timezone: z.literal('Asia/Ho_Chi_Minh'),
    immutableMonth: z.literal(true),
    rangeSemantics: z.literal('start_inclusive_end_exclusive'),
  }).strict(),
  paymentStatus: z.literal('canonical_a05_dual_approval_cycles'),
}).strict();

export const COMMISSION_HISTORY_BOUNDARY = commissionHistoryBoundarySchema.parse({
  requirementIds: ['F092', 'F093', 'QA03'],
  source: 'commission_ledger_entries',
  scope: 'admin_accountant_all_ctv_self',
  rawEventTimestamp: 'eligible_at',
  historyAvailable: true,
  monthlyStatement: {
    enabled: true,
    status: 'canonical_d09',
    monthAxis: 'eligible_at_first_contract_deposit_complete',
    timezone: 'Asia/Ho_Chi_Minh',
    immutableMonth: true,
    rangeSemantics: 'start_inclusive_end_exclusive',
  },
  paymentStatus: 'canonical_a05_dual_approval_cycles',
});

export const commissionHistoryItemSchema = commissionLedgerSummarySchema.extend({
  customerName: z.string(),
  buildingCode: z.string(),
  buildingName: z.string(),
  roomTypeName: z.string(),
  dealLifecycleStatus: z.enum(['active', 'cancelled']),
}).strict();

export const commissionHistoryQuerySchema = listQueryBaseSchema.extend({
  status: z.union([commissionLedgerStatusSchema, z.literal('')]).default(''),
  review: z.enum(['', 'required', 'clear']).default(''),
  workflow: z.enum(['', 'actionRequired', 'unpaid', 'paid']).default(''),
  collaboratorId: z.string().trim().max(160).default(''),
  sort: z.enum(['eligibleAt', 'createdAt', 'roomUnitCode', 'collaboratorName']).default('eligibleAt'),
});

export const commissionHistoryPageSchema = pagedResponseSchema(commissionHistoryItemSchema);

export const commissionMonthSchema = z.string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có định dạng YYYY-MM.');

export const commissionMonthlyStatementQuerySchema = z.object({
  month: commissionMonthSchema,
  collaboratorId: z.string().trim().max(160).default(''),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
}).strict();

export const commissionMonthlyStatementSchema = z.object({
  month: commissionMonthSchema,
  timezone: z.literal('Asia/Ho_Chi_Minh'),
  monthStartLocal: z.string(),
  nextMonthStartLocal: z.string(),
  summary: z.object({
    closedRoomCount: z.number().int().nonnegative(),
    reviewRequiredCount: z.number().int().nonnegative(),
    resolvedAmountCount: z.number().int().nonnegative(),
    pendingAmountCount: z.number().int().nonnegative(),
    resolvedCommissionTotal: z.number().nonnegative(),
    paidCount: z.number().int().nonnegative(),
    unpaidCount: z.number().int().nonnegative(),
    withdrawalRequestedCount: z.number().int().nonnegative(),
  }).strict(),
  items: z.array(commissionHistoryItemSchema),
  pagination: pagedResponseSchema(commissionHistoryItemSchema).shape.pagination,
}).strict();

export type CommissionCalculationRequest = z.infer<typeof commissionCalculationRequestSchema>;
export type CommissionExceptionResolutionRequest = z.infer<typeof commissionExceptionResolutionRequestSchema>;
export type CommissionCalculationFacts = z.infer<typeof commissionCalculationFactsSchema>;
export type CommissionExceptionResolutionHistoryItem = z.infer<typeof commissionExceptionResolutionHistoryItemSchema>;
export type CommissionAllocationSnapshotItem = z.infer<typeof commissionAllocationSnapshotItemSchema>;
export type CommissionLedgerStatus = z.infer<typeof commissionLedgerStatusSchema>;
export type CommissionPaymentStatus = z.infer<typeof commissionPaymentStatusSchema>;
export type CommissionLedgerSummary = z.infer<typeof commissionLedgerSummarySchema>;
export type CommissionHistoryQuery = z.infer<typeof commissionHistoryQuerySchema>;
export type CommissionHistoryItem = z.infer<typeof commissionHistoryItemSchema>;
export type CommissionMonthlyStatementQuery = z.infer<typeof commissionMonthlyStatementQuerySchema>;
export type CommissionMonthlyStatement = z.infer<typeof commissionMonthlyStatementSchema>;
