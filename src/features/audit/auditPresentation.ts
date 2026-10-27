import type { AuditListQuery, AuditSummary } from '@tinyhouse/contracts';

export const auditActions = [
  { value: 'CREATE', label: 'Thêm mới', color: 'success' },
  { value: 'UPDATE', label: 'Cập nhật', color: 'warning' },
  { value: 'DELETE', label: 'Xóa', color: 'error' },
] as const;

// Labels describe recorded entity codes, not permissions or inferred user roles.
export const auditEntities = [
  { value: 'user', label: 'Tài khoản' },
  { value: 'role', label: 'Vai trò' },
  { value: 'intake_request', label: 'Yêu cầu tư vấn / hợp tác' },
  { value: 'customer', label: 'Khách hàng' },
  { value: 'collaborator', label: 'Cộng tác viên' },
  { value: 'building', label: 'Tòa nhà' },
  { value: 'room_type', label: 'Loại phòng' },
  { value: 'room_unit', label: 'Căn phòng' },
  { value: 'booking', label: 'Lịch xem phòng' },
  { value: 'deal', label: 'Giao dịch thuê' },
  { value: 'amenity', label: 'Tiện ích' },
  { value: 'school', label: 'Trường học' },
  { value: 'collaborator_type', label: 'Loại cộng tác viên' },
  { value: 'commission_allocation_target', label: 'Cơ cấu hoa hồng' },
  { value: 'commission_ledger', label: 'Sổ hoa hồng' },
  { value: 'commission_calculation', label: 'Tính hoa hồng' },
  { value: 'commission_exception_resolution', label: 'Xử lý hủy / cọc' },
  { value: 'commission_payout_approval', label: 'Duyệt hoa hồng' },
  { value: 'commission_payout', label: 'Thanh toán hoa hồng' },
] as const;

export function auditAction(value: string) {
  return auditActions.find((item) => item.value === value)
    || { value, label: value || 'Không xác định', color: 'default' as const };
}
export function auditEntity(value: string) {
  return auditEntities.find((item) => item.value === value)?.label || value || 'Không xác định';
}
export function auditActor(log: Pick<AuditSummary, 'userName' | 'userEmail' | 'userId'>) {
  return log.userName.trim() || log.userEmail.trim() || log.userId.trim() || 'Không xác định';
}
export function auditTimestamp(value: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { date: '-', time: '', iso: undefined };
  return {
    date: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
    time: new Intl.DateTimeFormat('vi-VN', { timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
    iso: date.toISOString(),
  };
}
export function auditErrorMessage(error: unknown) {
  const status = Number((error as { status?: number } | null)?.status || 0);
  if (status === 403) return 'Bạn không còn quyền xem nhật ký hoạt động.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  return 'Không tải được nhật ký hoạt động. Vui lòng thử lại.';
}

export type AuditTableState = Omit<AuditListQuery, 'sort'>;
export const initialAuditTableState: AuditTableState = {
  page: 1, pageSize: 20, search: '', action: '', entityType: '', order: 'desc',
};
export type AuditTableAction =
  | { type: 'filter'; value: Partial<Pick<AuditTableState, 'search' | 'action' | 'entityType' | 'order'>> }
  | { type: 'page'; value: number }
  | { type: 'pageSize'; value: number }
  | { type: 'reset' };
export function auditTableReducer(state: AuditTableState, action: AuditTableAction): AuditTableState {
  switch (action.type) {
    case 'filter': return { ...state, ...action.value, page: 1 };
    case 'page': return { ...state, page: Math.max(1, action.value) };
    case 'pageSize': return { ...state, pageSize: action.value, page: 1 };
    case 'reset': return { ...initialAuditTableState, pageSize: state.pageSize };
  }
}
