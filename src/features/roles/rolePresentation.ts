import { CMS_ROLE_SCREENS, ROLE_FIXED_AUTHORITY_CODES, ROLE_RESERVED_CODES, ROLE_SYSTEM_CODES, type RoleSummary } from '@tinyhouse/contracts';

export function isSystemRole(code: string) {
  return (ROLE_SYSTEM_CODES as readonly string[]).includes(code);
}

export function isFixedAuthorityRole(code: string) {
  return (ROLE_FIXED_AUTHORITY_CODES as readonly string[]).includes(code);
}

export function roleCanBeDeleted(role: RoleSummary, userCount: number | undefined) {
  return !(ROLE_RESERVED_CODES as readonly string[]).includes(role.code)
    && userCount === 0;
}

export function roleDeleteReason(role: RoleSummary, userCount: number | undefined) {
  if (isSystemRole(role.code)) return 'Vai trò quản trị hệ thống';
  if (role.code === 'customer') return 'Vai trò Khách hàng được hệ thống bảo vệ';
  if (role.code === 'ctv_sale') return 'Vai trò CTV consumer được hệ thống bảo vệ';
  if (role.code === 'commission_accountant') return 'Vai trò Kế toán hoa hồng được hệ thống bảo vệ';
  if ((ROLE_RESERVED_CODES as readonly string[]).includes(role.code)) return 'Vai trò hệ thống được bảo vệ';
  if (userCount === undefined) return 'Chưa tải được số tài khoản';
  if (userCount > 0) return `Đang có ${userCount} tài khoản sử dụng`;
  return '';
}

export function editableRoleScreens(role?: RoleSummary) {
  const available = CMS_ROLE_SCREENS.map((screen) => screen.code);
  if (role && (isSystemRole(role.code) || role.allowedScreens.includes('*'))) return [...available];
  return available.filter((code) => role?.allowedScreens.includes(code));
}

export function unsupportedRoleScreens(role: RoleSummary) {
  if (isSystemRole(role.code)) return [];
  return role.allowedScreens.filter((code) => !CMS_ROLE_SCREENS.some((screen) => screen.code === code));
}

export function roleErrorMessage(error: unknown) {
  const failure = error as { status?: number; message?: string };
  if (failure?.status && failure.status < 500) return failure.message || 'Không thể thực hiện thao tác này.';
  return 'Không thể lưu thay đổi. Vui lòng thử lại.';
}
