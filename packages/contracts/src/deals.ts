import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const dealContractMonthsSchema = z.number()
  .int('Số tháng hợp đồng phải là số nguyên.')
  .positive('Số tháng hợp đồng phải lớn hơn 0.')
  .nullable();

export const createDealFromBookingRequestSchema = z.object({
  bookingId: z.string().trim().min(1).max(160),
  roomUnitId: z.string().trim().min(1).max(160),
  finalPrice: z.number().finite().nonnegative(),
  contractMonths: dealContractMonthsSchema.optional().default(null),
  notes: z.string().trim().max(4000).optional().default(''),
}).strict();

export const createDealDirectRequestSchema = z.object({
  customerId: z.string().trim().min(1).max(160),
  roomUnitId: z.string().trim().min(1).max(160),
  finalPrice: z.number().finite().nonnegative(),
  contractMonths: dealContractMonthsSchema.optional().default(null),
  assignedUserId: z.string().trim().min(1).max(160).nullable().optional().default(null),
  notes: z.string().trim().max(4000).optional().default(''),
}).strict();

export const updateDealCommercialTermsRequestSchema = z.object({
  finalPrice: z.number().finite().nonnegative(),
  contractMonths: dealContractMonthsSchema,
}).strict();

export const dealAssignmentRequestSchema = z.object({
  assignedUserId: z.string().trim().min(1).max(160).nullable(),
}).strict();

export const dealNoteRequestSchema = z.object({
  note: z.string().trim().min(1, 'Vui lòng nhập nội dung ghi chú.').max(4000),
}).strict();

export const dealAssigneeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  roleCode: z.string(),
  roleName: z.string(),
  dealScope: z.enum(['all', 'assigned']),
}).strict();
export const dealAssigneeListSchema = z.array(dealAssigneeSchema);

export const updateDealContractDepositRequestSchema = z.object({
  contractSigned: z.boolean(),
  depositRequiredAmount: z.number().finite().positive().nullable(),
  depositPaidAmount: z.number().finite().nonnegative(),
}).strict();

const rentalDateSchema = z.string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày thuê phải có định dạng YYYY-MM-DD.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }, 'Ngày thuê không hợp lệ.');

export const DEAL_LIFECYCLE_STATUSES = ['active', 'cancelled'] as const;
export const dealLifecycleStatusSchema = z.enum(DEAL_LIFECYCLE_STATUSES);

export const dealFinanceBoundarySchema = z.object({
  recurringRent: z.object({
    requirementId: z.literal('QA02'),
    owner: z.literal('cyhome'),
    managedByTinyHouses: z.literal(false),
    integrationDecision: z.literal('pending'),
  }).strict(),
  invoices: z.object({
    requirementId: z.literal('F075'),
    status: z.literal('scope_pending'),
  }).strict(),
  refunds: z.object({
    requirementId: z.literal('F076'),
    status: z.literal('scope_pending'),
  }).strict(),
}).strict();

export const DEAL_FINANCE_BOUNDARY = dealFinanceBoundarySchema.parse({
  recurringRent: {
    requirementId: 'QA02',
    owner: 'cyhome',
    managedByTinyHouses: false,
    integrationDecision: 'pending',
  },
  invoices: { requirementId: 'F075', status: 'scope_pending' },
  refunds: { requirementId: 'F076', status: 'scope_pending' },
});

export const changeDealRoomUnitRequestSchema = z.object({
  roomUnitId: z.string().trim().min(1).max(160),
}).strict();

export const cancelDealRequestSchema = z.object({
  reason: z.string().trim().max(1000).nullable().default(null),
}).strict();

export const updateDealRentalScheduleRequestSchema = z.object({
  rentalStartDate: rentalDateSchema.nullable(),
  rentalEndDate: rentalDateSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.rentalEndDate && !value.rentalStartDate) {
    context.addIssue({
      code: 'custom',
      path: ['rentalStartDate'],
      message: 'Ngày kết thúc yêu cầu có ngày bắt đầu thuê.',
    });
  }
  if (value.rentalStartDate && value.rentalEndDate && value.rentalEndDate < value.rentalStartDate) {
    context.addIssue({
      code: 'custom',
      path: ['rentalEndDate'],
      message: 'Ngày kết thúc thuê không được trước ngày bắt đầu.',
    });
  }
});

export const dealActivityItemSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  detail: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string(),
  createdAt: z.string().min(1),
}).strict();

export const dealSummarySchema = z.object({
  id: z.string().min(1),
  bookingId: z.string().nullable(),
  bookingStatus: z.string().nullable(),
  customerId: z.string().min(1),
  customerUserId: z.string().nullable(),
  customerName: z.string(),
  customerPhone: z.string(),
  collaboratorId: z.string().nullable(),
  collaboratorName: z.string(),
  sourceType: z.string(),
  sourceChannel: z.string(),
  sourceRecordedAt: z.string().nullable(),
  assignedUserId: z.string().nullable(),
  assignedUserName: z.string(),
  assignedUserEmail: z.string(),
  notes: z.string(),
  roomUnitId: z.string().min(1),
  roomUnitCode: z.string(),
  roomTypeId: z.string().min(1),
  roomTypeName: z.string(),
  buildingId: z.string().min(1),
  buildingCode: z.string(),
  buildingName: z.string(),
  finalPrice: z.number().nonnegative(),
  contractMonths: z.number().int().positive().nullable(),
  contractSignedAt: z.string().nullable(),
  contractSigned: z.boolean(),
  depositRequiredAmount: z.number().nonnegative().nullable(),
  depositPaidAmount: z.number().nonnegative(),
  depositFullyPaid: z.boolean(),
  contractDepositComplete: z.boolean(),
  rentalStartDate: z.string().nullable(),
  rentalEndDate: z.string().nullable(),
  rentalScheduleComplete: z.boolean(),
  lifecycleStatus: dealLifecycleStatusSchema,
  cancelledAt: z.string().nullable(),
  cancellationReason: z.string(),
  activity: z.array(dealActivityItemSchema),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).strict();

export const dealListQuerySchema = listQueryBaseSchema.extend({
  bookingId: z.string().trim().max(160).default(''),
  customerId: z.string().trim().max(160).default(''),
  lifecycleStatus: z.union([dealLifecycleStatusSchema, z.literal('')]).default(''),
  rentalSchedule: z.enum(['', 'scheduled', 'unscheduled', 'complete', 'partial']).default(''),
  rentalDateFrom: z.union([rentalDateSchema, z.literal('')]).default(''),
  rentalDateTo: z.union([rentalDateSchema, z.literal('')]).default(''),
  sort: z.enum(['createdAt', 'customerName', 'finalPrice', 'rentalStartDate']).default('createdAt'),
}).superRefine((value, context) => {
  if (value.rentalDateFrom && value.rentalDateTo && value.rentalDateTo < value.rentalDateFrom) {
    context.addIssue({ code: 'custom', path: ['rentalDateTo'], message: 'Đến ngày không được trước từ ngày.' });
  }
});

export const dealRoomUnitHistoryItemSchema = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  fromRoomUnitId: z.string().min(1),
  fromRoomUnitCode: z.string(),
  toRoomUnitId: z.string().min(1),
  toRoomUnitCode: z.string(),
  changedByUserId: z.string().nullable(),
  changedByName: z.string(),
  changedAt: z.string(),
}).strict();

export const dealRoomUnitHistorySchema = z.array(dealRoomUnitHistoryItemSchema);

export const dealPageSchema = pagedResponseSchema(dealSummarySchema);

export type CreateDealFromBookingRequest = z.infer<typeof createDealFromBookingRequestSchema>;
export type CreateDealDirectRequest = z.infer<typeof createDealDirectRequestSchema>;
export type UpdateDealCommercialTermsRequest = z.infer<typeof updateDealCommercialTermsRequestSchema>;
export type DealAssignmentRequest = z.infer<typeof dealAssignmentRequestSchema>;
export type DealNoteRequest = z.infer<typeof dealNoteRequestSchema>;
export type DealAssignee = z.infer<typeof dealAssigneeSchema>;
export type DealActivityItem = z.infer<typeof dealActivityItemSchema>;
export type UpdateDealContractDepositRequest = z.infer<typeof updateDealContractDepositRequestSchema>;
export type ChangeDealRoomUnitRequest = z.infer<typeof changeDealRoomUnitRequestSchema>;
export type CancelDealRequest = z.infer<typeof cancelDealRequestSchema>;
export type UpdateDealRentalScheduleRequest = z.infer<typeof updateDealRentalScheduleRequestSchema>;
export type DealRoomUnitHistoryItem = z.infer<typeof dealRoomUnitHistoryItemSchema>;
export type DealFinanceBoundary = z.infer<typeof dealFinanceBoundarySchema>;
export type DealSummary = z.infer<typeof dealSummarySchema>;
export type DealListQuery = z.infer<typeof dealListQuerySchema>;
