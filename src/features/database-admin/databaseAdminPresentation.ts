import { databaseSnapshotSchema, type DatabaseSnapshot } from '@tinyhouse/contracts';

const tableLabels: Record<string, string> = {
  roles: 'Vai trò', users: 'Tài khoản', buildings: 'Tòa nhà', rooms: 'Loại phòng',
  room_units: 'Căn phòng', room_unit_migration_review: 'Rà soát mã căn',
  customers: 'Khách hàng', collaborators: 'Cộng tác viên', bookings: 'Lịch xem phòng',
  deals: 'Giao dịch thuê', deal_room_unit_history: 'Lịch sử đổi căn',
  amenities: 'Tiện ích', building_amenities: 'Tiện ích theo tòa',
  room_type_amenities: 'Tiện ích theo loại phòng', schools: 'Trường học',
  collaborator_types: 'Loại cộng tác viên', commission_policy_configs: 'Chính sách hoa hồng lưu trữ',
  commission_allocation_targets: 'Cơ cấu phân bổ', commission_ledger_entries: 'Sổ hoa hồng',
  commissions: 'Hoa hồng lịch sử', audit_logs: 'Nhật ký hoạt động', refresh_tokens: 'Phiên đăng nhập',
};

export function databaseTableLabel(key: string) { return tableLabels[key] || key; }
export function databaseNumber(value: number | undefined) {
  return value === undefined ? '-' : new Intl.NumberFormat('vi-VN').format(value);
}
export function databaseTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
export function databaseFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function validateSnapshot(value: unknown): DatabaseSnapshot {
  const parsed = databaseSnapshotSchema.safeParse(value);
  // Never show raw Zod issues/input: a snapshot contains account/password hashes.
  if (!parsed.success) throw new Error('Bản sao lưu sai định dạng hoặc phiên bản chưa được hỗ trợ.');
  for (const [table, rows] of Object.entries(parsed.data.data)) {
    const declared = parsed.data.metadata.counts[table];
    if (declared !== undefined && declared !== rows.length) {
      throw new Error(`Số bản ghi của bảng ${databaseTableLabel(table)} không khớp metadata.`);
    }
  }
  return parsed.data;
}

export function parseSnapshotText(text: string) {
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Không đọc được tệp. Hãy chọn bản sao lưu hợp lệ.'); }
  return validateSnapshot(value);
}

export function databaseAdminError(error: unknown, fallback: string) {
  // Validation errors can contain sensitive values; do not serialize/log them.
  if (error instanceof Error && error.name !== 'ZodError') return error.message;
  return fallback;
}
