import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const CMS_ROLE_SCREENS = [
  { code: 'dashboard', label: 'Tổng quan', description: 'Xem trang tổng quan hệ thống.' },
  { code: 'buildings', label: 'Tòa nhà', description: 'Truy cập quản lý tòa nhà trong phạm vi được phép.' },
  { code: 'rooms', label: 'Phòng', description: 'Truy cập quản lý phòng trong phạm vi được phép.' },
  { code: 'bookings', label: 'Lịch xem phòng', description: 'Xem và xử lý lịch hẹn theo quyền hiện có.' },
  { code: 'deals', label: 'Giao dịch thuê', description: 'Xem giao dịch thuê theo phạm vi được phân quyền.' },
  { code: 'commissionHistory', label: 'Lịch sử hoa hồng', description: 'Xem, đối soát và duyệt các khoản hoa hồng theo vai trò.' },
  { code: 'auditlog', label: 'Nhật ký hoạt động', description: 'Tra cứu lịch sử thao tác hệ thống.' },
] as const;

export const ROLE_SYSTEM_CODES = ['admin', 'superadmin'] as const;
export const ROLE_FIXED_AUTHORITY_CODES = ['ctv_sale', 'commission_accountant', 'customer'] as const;
/** Only configurable CMS roles can be stacked onto an account as extra roles. */
export function isCombinableRoleCode(code: string) {
  return ![...ROLE_SYSTEM_CODES, ...ROLE_FIXED_AUTHORITY_CODES, 'unassigned'].includes(code as never);
}
export const BOOKING_SCOPES =['none', 'all', 'assigned'] as const;
export const bookingScopeSchema = z.enum(BOOKING_SCOPES);
export const DEAL_SCOPES = ['none', 'all', 'assigned'] as const;
export const dealScopeSchema = z.enum(DEAL_SCOPES);
// Existing backend authority codes, canonical booking roles and the identity's unassigned sentinel.
export const ROLE_RESERVED_CODES = [
  ...ROLE_SYSTEM_CODES,
  'b2c_admin', 'sale', 'manager', 'building_manager',
  ...ROLE_FIXED_AUTHORITY_CODES,
  'unassigned',
] as const;

export const roleScreenSchema = z.enum([
  ...CMS_ROLE_SCREENS.map((screen) => screen.code),
  '*', 'permissions', 'database',
]);

export const roleSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  // Read existing values so old permissions can be reviewed and removed.
  allowedScreens: z.array(z.string()),
  bookingScope: bookingScopeSchema,
  bookingCanAssign: z.boolean(),
  bookingCanReassign: z.boolean(),
  bookingCanTransition: z.boolean(),
  bookingCanCancel: z.boolean(),
  bookingCanReschedule: z.boolean(),
  dealScope: dealScopeSchema,
  dealCanCreate: z.boolean(),
  dealCanCreateDirect: z.boolean(),
  dealCanManageContractDeposit: z.boolean(),
  dealCanManageRentalSchedule: z.boolean(),
  dealCanManageLifecycle: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const roleListItemSchema = roleSummarySchema.extend({ userCount: z.number().int().nonnegative() });
export const roleListQuerySchema = listQueryBaseSchema.extend({
  sort: z.enum(['createdAt', 'name', 'code', 'userCount']).default('createdAt'),
});
export const rolePageSchema = pagedResponseSchema(roleListItemSchema);

export const roleWriteSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(64)
      .regex(/^[a-z][a-z0-9_]*$/, 'Mã vai trò chỉ gồm chữ thường, số và dấu gạch dưới; bắt đầu bằng chữ.'),
    description: z.string().trim().max(1000).optional(),
    allowedScreens: z.array(roleScreenSchema),
    bookingScope: bookingScopeSchema,
    bookingCanAssign: z.boolean(),
    bookingCanReassign: z.boolean(),
    bookingCanTransition: z.boolean(),
    bookingCanCancel: z.boolean(),
    bookingCanReschedule: z.boolean(),
    dealScope: dealScopeSchema,
    dealCanCreate: z.boolean(),
    dealCanCreateDirect: z.boolean(),
    dealCanManageContractDeposit: z.boolean(),
    dealCanManageRentalSchedule: z.boolean(),
    dealCanManageLifecycle: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasBookingScreen = value.allowedScreens.includes('*') || value.allowedScreens.includes('bookings');
    if (value.bookingScope === 'none' && hasBookingScreen) {
      context.addIssue({ code: 'custom', path: ['bookingScope'], message: 'Vai trò có màn Lịch xem phải chọn phạm vi dữ liệu.' });
    }
    if (value.bookingScope !== 'none' && !hasBookingScreen) {
      context.addIssue({ code: 'custom', path: ['allowedScreens'], message: 'Phạm vi lịch xem yêu cầu quyền màn Lịch xem phòng.' });
    }
    if ((value.bookingCanAssign || value.bookingCanReassign) && value.bookingScope !== 'all') {
      context.addIssue({ code: 'custom', path: ['bookingScope'], message: 'Chỉ vai trò xem toàn bộ lịch mới được phân công hoặc giao lại.' });
    }
    if (value.bookingCanReassign && !value.bookingCanAssign) {
      context.addIssue({ code: 'custom', path: ['bookingCanReassign'], message: 'Quyền giao lại yêu cầu quyền phân công.' });
    }
    if ((value.bookingCanTransition || value.bookingCanCancel || value.bookingCanReschedule) && value.bookingScope === 'none') {
      context.addIssue({ code: 'custom', path: ['bookingScope'], message: 'Quyền thao tác lịch xem yêu cầu phạm vi dữ liệu lịch xem.' });
    }

    const hasDealScreen = value.allowedScreens.includes('*') || value.allowedScreens.includes('deals');
    if (value.dealScope === 'none' && hasDealScreen) {
      context.addIssue({ code: 'custom', path: ['dealScope'], message: 'Vai trò có màn Giao dịch thuê phải chọn phạm vi dữ liệu Deal.' });
    }
    if (value.dealScope !== 'none' && !hasDealScreen) {
      context.addIssue({ code: 'custom', path: ['allowedScreens'], message: 'Phạm vi Deal yêu cầu quyền màn Giao dịch thuê.' });
    }
    if ((value.dealCanCreate || value.dealCanCreateDirect) && value.dealScope !== 'all') {
      context.addIssue({ code: 'custom', path: ['dealScope'], message: 'Chỉ vai trò xem toàn bộ Deal mới được tạo giao dịch.' });
    }
    if (value.dealCanCreateDirect && !value.dealCanCreate) {
      context.addIssue({ code: 'custom', path: ['dealCanCreateDirect'], message: 'Tạo Deal trực tiếp yêu cầu quyền tạo Deal.' });
    }
    if (value.dealCanManageContractDeposit && value.dealScope !== 'all') {
      context.addIssue({ code: 'custom', path: ['dealCanManageContractDeposit'], message: 'Chỉ vai trò xem toàn bộ Deal mới được cập nhật hợp đồng/cọc.' });
    }
    if (value.dealCanManageRentalSchedule && value.dealScope !== 'all') {
      context.addIssue({ code: 'custom', path: ['dealCanManageRentalSchedule'], message: 'Chỉ vai trò xem toàn bộ Deal mới được cập nhật lịch thuê.' });
    }
    if (value.dealCanManageLifecycle && value.dealScope !== 'all') {
      context.addIssue({ code: 'custom', path: ['dealCanManageLifecycle'], message: 'Chỉ vai trò xem toàn bộ Deal mới được đổi căn hoặc hủy Deal.' });
    }
  });

export type RoleWrite = z.infer<
  typeof roleWriteSchema
>;
export type RoleSummary = z.infer<typeof roleSummarySchema>;
export type CmsRoleScreen = typeof CMS_ROLE_SCREENS[number]['code'];

export type RoleListItem = z.infer<typeof roleListItemSchema>;
export type RoleListQuery = z.infer<typeof roleListQuerySchema>;
