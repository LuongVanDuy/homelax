import { z } from 'zod';
import { listQueryBaseSchema, paginationSchema } from './list.js';

export const AFFILIATE_SOURCE_CHANNEL = 'Affiliate link';

export const affiliateTokenSchema = z.string()
  .trim()
  .regex(/^ref_[0-9a-f]{24}$/, 'Affiliate token không hợp lệ.');

export const affiliateReferralSchema = z.object({
  collaboratorId: z.string().trim().min(1),
  collaboratorName: z.string(),
  phone: z.string(),
  affiliateToken: affiliateTokenSchema,
}).strict();

export const CTV_CUSTOMER_JOURNEY_STAGES = [
  'introduced',
  'booking',
  'deal',
  'deposited',
  'closed',
  'cancelled',
] as const;

export const ctvCustomerJourneyStageSchema = z.enum(CTV_CUSTOMER_JOURNEY_STAGES);

export const ctvMyCustomersQuerySchema = listQueryBaseSchema.extend({
  stage: z.union([ctvCustomerJourneyStageSchema, z.literal('')]).default(''),
  sort: z.enum(['sourceRecordedAt', 'customerName', 'latestActivityAt']).default('sourceRecordedAt'),
}).strict();

export const ctvCustomerBookingSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  appointmentAt: z.string().nullable(),
  buildingCode: z.string(),
  buildingName: z.string(),
  roomUnitId: z.string().nullable(),
  roomUnitCode: z.string(),
  roomTypeName: z.string(),
}).strict();

export const ctvCustomerDealSchema = z.object({
  id: z.string().min(1),
  lifecycleStatus: z.enum(['active', 'cancelled']),
  buildingCode: z.string(),
  buildingName: z.string(),
  roomUnitId: z.string().min(1),
  roomUnitCode: z.string(),
  roomTypeName: z.string(),
  finalPrice: z.number().nonnegative(),
  contractMonths: z.number().int().positive().nullable(),
  contractSigned: z.boolean(),
  depositRequiredAmount: z.number().nonnegative().nullable(),
  depositPaidAmount: z.number().nonnegative(),
  contractDepositComplete: z.boolean(),
  createdAt: z.string().nullable(),
}).strict();

export const ctvCustomerCommissionSummarySchema = z.object({
  totalAmount: z.number().nonnegative(),
  pendingApprovalAmount: z.number().nonnegative(),
  approvedUnpaidAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  reviewAmount: z.number().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  latestPayoutCycleDate: z.string().nullable(),
}).strict();

export const ctvMyCustomerItemSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string(),
  phone: z.string(),
  sourceRecordedAt: z.string().nullable(),
  createdAt: z.string(),
  latestActivityAt: z.string(),
  stage: ctvCustomerJourneyStageSchema,
  latestBooking: ctvCustomerBookingSchema.nullable(),
  latestDeal: ctvCustomerDealSchema.nullable(),
  commission: ctvCustomerCommissionSummarySchema,
}).strict();

export const ctvMyCustomersStatsSchema = z.object({
  customerCount: z.number().int().nonnegative(),
  bookingCount: z.number().int().nonnegative(),
  depositedCustomerCount: z.number().int().nonnegative(),
  closedCustomerCount: z.number().int().nonnegative(),
  commissionPendingApprovalAmount: z.number().nonnegative(),
  commissionApprovedUnpaidAmount: z.number().nonnegative(),
  commissionPaidAmount: z.number().nonnegative(),
  commissionReviewAmount: z.number().nonnegative(),
  commissionUnresolvedCount: z.number().int().nonnegative(),
}).strict();

export const ctvMyCustomersWorkspaceSchema = z.object({
  referral: affiliateReferralSchema,
  stats: ctvMyCustomersStatsSchema,
  items: z.array(ctvMyCustomerItemSchema),
  pagination: paginationSchema,
}).strict();

export type AffiliateReferral = z.infer<typeof affiliateReferralSchema>;
export type CtvMyCustomersQuery = z.infer<typeof ctvMyCustomersQuerySchema>;
export type CtvMyCustomerItem = z.infer<typeof ctvMyCustomerItemSchema>;
export type CtvMyCustomersStats = z.infer<typeof ctvMyCustomersStatsSchema>;
export type CtvMyCustomersWorkspace = z.infer<typeof ctvMyCustomersWorkspaceSchema>;
