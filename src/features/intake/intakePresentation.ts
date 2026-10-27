import type { IntakeStatus } from '@tinyhouse/contracts';

export const intakeKinds = {
  landlord_consultation: 'Tư vấn chủ nhà', collaborator_registration: 'Đăng ký CTV',
  collaborator_consultation: 'Tư vấn CTV', general_contact: 'Liên hệ chung',
};
export const intakeStatuses: Record<IntakeStatus, string> = {
  new: 'Mới', processing: 'Đang xử lý', completed: 'Hoàn tất', rejected: 'Từ chối', spam: 'Tin rác',
};
export const intakeColors = { new: 'primary', processing: 'info', completed: 'success', rejected: 'error', spam: 'secondary' } as const;
export const intakeDate = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value));
