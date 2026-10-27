import type { UserStatus } from '@tinyhouse/contracts';

export function isAdminRole(role: string) {
  return role === 'admin' || role === 'superadmin';
}

export function canonicalUserStatus(value: string): UserStatus | '' {
  if (['Hoạt động', 'active', 'approved', 'enabled'].includes(value)) return 'Hoạt động';
  if (value === 'Chờ duyệt' || value === 'Đã khóa' || value === 'Từ chối') return value;
  return '';
}

export function userErrorMessage(error: unknown) {
  const failure = error as { status?: number; message?: string };
  if (failure?.status === 409) return failure.message || 'Email đã được sử dụng. Vui lòng chọn email khác.';
  if (failure?.status && failure.status < 500) return failure.message || 'Không thể thực hiện thao tác này.';
  return 'Không thể lưu thay đổi. Vui lòng thử lại.';
}
