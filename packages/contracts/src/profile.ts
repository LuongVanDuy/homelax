import { z } from 'zod';

export const profileGenderSchema = z.enum(['male', 'female', 'other']).nullable();

/** Account identity key only; CRM contacts and booking ownership are independent. */
export function normalizeAccountPhone(value: string | null | undefined) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0084')) return `0${digits.slice(4)}`;
  if (digits.startsWith('84')) return `0${digits.slice(2)}`;
  return digits;
}

function validBirthDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export const profileBirthDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh phải có định dạng YYYY-MM-DD.')
  .refine(validBirthDate, 'Ngày sinh không hợp lệ.')
  .refine((value) => value <= new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()), 'Ngày sinh không được ở tương lai.')
  .nullable();

export const profilePhoneSchema = z.string().trim().max(32)
  .refine((value) => !value || /^[+\d][\d\s().-]{5,31}$/.test(value), 'Số điện thoại chưa đúng định dạng.');

// New avatar values use the existing authenticated local image upload.
// Existing historical avatar URLs remain readable; no remote fetch is introduced.
export const profileAvatarSchema = z.string().trim().max(2048).refine(
  (value) => value === '' || /^\/uploads\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|gif|avif)$/i.test(value),
  'Vui lòng chọn ảnh từ chức năng tải ảnh đại diện.',
);

export const personalProfileShape = {
  name: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(200).optional(),
  phone: profilePhoneSchema.optional(),
  avatar: profileAvatarSchema.optional(),
  gender: profileGenderSchema.optional(),
  birthDate: profileBirthDateSchema.optional(),
  address: z.string().trim().max(1000).optional(),
};
