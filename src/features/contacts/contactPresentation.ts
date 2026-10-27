import type { ContactKind } from './api/contact.keys';

export const contactLabels: Record<ContactKind, { title: string; singular: string; create: string }> = {
  customers: { title: 'Khách hàng', singular: 'khách hàng', create: 'Thêm khách hàng' },
  collaborators: { title: 'Cộng tác viên', singular: 'cộng tác viên', create: 'Thêm cộng tác viên' },
};

export function contactSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function contactErrorMessage(error: unknown) {
  const failure = error as { status?: number; message?: string };
  if (failure?.status && failure.status < 500) return failure.message || 'Không thể thực hiện thao tác này.';
  return 'Không thể lưu thay đổi. Vui lòng thử lại.';
}

export function displayRecordedDate(value: string | null | undefined) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
