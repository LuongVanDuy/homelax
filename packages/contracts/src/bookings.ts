import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';
import { affiliateTokenSchema } from './affiliate.js';

export const BOOKING_STATUSES = [
  'Chờ xác nhận',
  'Đã xác nhận',
  'Đã xem phòng',
  'Đã huỷ',
  'Đã cọc',
  'Đã chốt',
] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

export const BOOKING_TRANSITIONS = [
  'confirm',
  'markViewed',
  'markDeposit',
  'close',
  'cancel',
] as const;
export type BookingTransition = typeof BOOKING_TRANSITIONS[number];
export const bookingTransitionSchema = z.enum(BOOKING_TRANSITIONS);

const BOOKING_TRANSITION_TARGETS: Record<
  BookingStatus,
  Partial<Record<BookingTransition, BookingStatus>>
> = {
  'Chờ xác nhận': { confirm: 'Đã xác nhận', cancel: 'Đã huỷ' },
  'Đã xác nhận': { markViewed: 'Đã xem phòng', cancel: 'Đã huỷ' },
  'Đã xem phòng': { markDeposit: 'Đã cọc', cancel: 'Đã huỷ' },
  'Đã huỷ': {},
  'Đã cọc': { close: 'Đã chốt' },
  'Đã chốt': {},
};

export function bookingTransitionTarget(
  status: BookingStatus,
  transition: BookingTransition,
) {
  return BOOKING_TRANSITION_TARGETS[status]?.[transition] ?? null;
}

export function bookingAllowedTransitions(status: BookingStatus) {
  return Object.keys(BOOKING_TRANSITION_TARGETS[status] || {}) as BookingTransition[];
}

export function bookingCanRescheduleStatus(status: BookingStatus) {
  return status === 'Chờ xác nhận' || status === 'Đã xác nhận';
}

export const BOOKING_MIN_LEAD_MINUTES = 60;
export const BOOKING_MIN_LEAD_MS = BOOKING_MIN_LEAD_MINUTES * 60 * 1000;
export const BOOKING_OCCUPIED_MIN_LEAD_MINUTES = 24 * 60;
export const BOOKING_OCCUPIED_MIN_LEAD_MS =
  BOOKING_OCCUPIED_MIN_LEAD_MINUTES * 60 * 1000;
export const BOOKING_REMINDER_TEXT =
  'Vui lòng đặt lịch hẹn trước 1h để được hỗ trợ tốt nhất!';
export const BOOKING_SUCCESS_TEXT =
  'Đặt lịch xem phòng thành công, hãy chú ý điện thoại bạn nha!';

const bookingDateSchema = z.string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hẹn phải có định dạng YYYY-MM-DD.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  }, 'Ngày hẹn không hợp lệ.');

const bookingTimeSchema = z.string()
  .trim()
  .min(1, 'Vui lòng chọn giờ hẹn.')
  .refine((value) => normalizeBookingTime24h(value) !== null, {
    message: 'Giờ hẹn không hợp lệ.',
  });

export function normalizeBookingTime24h(value: string) {
  const input = String(value || '').trim();
  const twentyFour = input.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (twentyFour) return `${twentyFour[1]}:${twentyFour[2]}`;

  const twelve = input.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
  if (!twelve) return null;

  let hour = Number(twelve[1]);
  const minute = twelve[2];
  const meridiem = twelve[3].toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

export function bookingAppointmentAt(
  appointmentDate: string,
  appointmentTime: string,
  appointmentTimezoneOffsetMinutes: number,
) {
  const normalizedTime = normalizeBookingTime24h(appointmentTime);
  const dateResult = bookingDateSchema.safeParse(appointmentDate);
  if (!dateResult.success || !normalizedTime) return null;
  if (!Number.isInteger(appointmentTimezoneOffsetMinutes)
      || appointmentTimezoneOffsetMinutes < -840
      || appointmentTimezoneOffsetMinutes > 840) {
    return null;
  }

  const [year, month, day] = appointmentDate.split('-').map(Number);
  const [hour, minute] = normalizedTime.split(':').map(Number);
  const localClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(
    localClockAsUtc + appointmentTimezoneOffsetMinutes * 60 * 1000,
  );
}

export function bookingMeetsMinimumLeadTime(
  appointmentDate: string,
  appointmentTime: string,
  appointmentTimezoneOffsetMinutes: number,
  nowMs = Date.now(),
) {
  const appointment = bookingAppointmentAt(
    appointmentDate,
    appointmentTime,
    appointmentTimezoneOffsetMinutes,
  );
  return Boolean(
    appointment
    && appointment.getTime() >= nowMs + BOOKING_MIN_LEAD_MS,
  );
}

export type BookingRoomUnitStatus =
  | 'available'
  | 'occupied'
  | 'maintenance'
  | 'archived';

export type BookingRoomUnitEligibility = {
  allowed: boolean;
  message: string;
  requiredLeadMinutes: number;
};

function bookingDateLabel(value: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/**
 * FE05.2/G04 canonical public viewing policy.
 * Backend remains authoritative and must evaluate this after locking the current Room Unit.
 */
export function bookingRoomUnitEligibility({
  status,
  availableFrom,
  appointmentDate,
  appointmentTime,
  appointmentTimezoneOffsetMinutes,
  nowMs = Date.now(),
}: {
  status: BookingRoomUnitStatus;
  availableFrom?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  appointmentTimezoneOffsetMinutes: number;
  nowMs?: number;
}): BookingRoomUnitEligibility {
  const appointment = bookingAppointmentAt(
    appointmentDate,
    appointmentTime,
    appointmentTimezoneOffsetMinutes,
  );
  if (!appointment) {
    return {
      allowed: false,
      message: 'Thời gian hẹn không hợp lệ.',
      requiredLeadMinutes: BOOKING_MIN_LEAD_MINUTES,
    };
  }

  if (status === 'archived') {
    return {
      allowed: false,
      message: 'Căn xem không tồn tại hoặc không còn hoạt động.',
      requiredLeadMinutes: BOOKING_MIN_LEAD_MINUTES,
    };
  }

  const requiredLeadMinutes = status === 'occupied'
    ? BOOKING_OCCUPIED_MIN_LEAD_MINUTES
    : BOOKING_MIN_LEAD_MINUTES;
  const requiredLeadMs = requiredLeadMinutes * 60 * 1000;
  if (appointment.getTime() < nowMs + requiredLeadMs) {
    return {
      allowed: false,
      message: status === 'occupied'
        ? 'Căn đang có người thuê. Vui lòng đặt lịch xem trước ít nhất 24 giờ để Tiny Houses phối hợp với khách đang ở.'
        : 'Vui lòng đặt lịch hẹn trước ít nhất 1 giờ.',
      requiredLeadMinutes,
    };
  }

  if (status === 'maintenance') {
    const availableResult = bookingDateSchema.safeParse(availableFrom || '');
    if (!availableResult.success) {
      return {
        allowed: false,
        message: 'Căn đang bảo trì và chưa có ngày dự kiến hoàn tất, hiện chưa thể đặt lịch xem.',
        requiredLeadMinutes,
      };
    }
    if (appointmentDate < availableResult.data) {
      return {
        allowed: false,
        message: `Căn đang bảo trì. Vui lòng chọn ngày hẹn từ ${bookingDateLabel(availableResult.data)} trở đi.`,
        requiredLeadMinutes,
      };
    }
  }

  if (!['available', 'occupied', 'maintenance'].includes(status)) {
    return {
      allowed: false,
      message: 'Trạng thái căn hiện không cho phép đặt lịch xem.',
      requiredLeadMinutes,
    };
  }

  return {
    allowed: true,
    message: '',
    requiredLeadMinutes,
  };
}

export const bookingPublicReceiptSchema = z.object({
  id: z.string().min(1),
  roomUnitId: z.string().min(1),
  roomUnitCode: z.string(),
  buildingCode: z.string(),
  buildingName: z.string(),
  roomTypeName: z.string(),
  appointmentDate: z.string().min(1),
  appointmentTime: z.string().min(1),
  appointmentAt: z.string().min(1),
  appointmentTimezoneOffsetMinutes: z.number().int(),
  status: bookingStatusSchema,
}).strict();

export const bookingSummarySchema = z.object({
  id: z.string().min(1),
  customerName: z.string(),
  phone: z.string(),
  email: z.string(),
  customerId: z.string().nullable(),
  dealId: z.string().nullable(),
  collaboratorId: z.string().nullable(),
  sourceType: z.string(),
  sourceChannel: z.string(),
  sourceRecordedAt: z.string().nullable(),
  collaboratorName: z.string(),
  assignedUserId: z.string().nullable(),
  assignedUserName: z.string(),
  assignedUserEmail: z.string(),
  finalPrice: z.number().nonnegative().nullable(),
  roomUnitId: z.string().nullable(),
  buildingId: z.string(),
  buildingCode: z.string(),
  buildingName: z.string(),
  roomTypeId: z.string().nullable(),
  roomTypeName: z.string(),
  roomNumber: z.string(),
  appointmentDate: z.string().nullable(),
  appointmentTime: z.string(),
  appointmentAt: z.string().nullable(),
  appointmentTimezoneOffsetMinutes: z.number().int().nullable(),
  status: bookingStatusSchema,
  notes: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const bookingListQuerySchema = listQueryBaseSchema.extend({
  status: z.union([bookingStatusSchema, z.literal('')]).default(''),
  customerId: z.string().trim().max(160).default(''),
  building: z.string().trim().max(200).default(''),
  dateFrom: z.string().trim().max(10).default(''),
  dateTo: z.string().trim().max(10).default(''),
  assignee: z.string().trim().max(160).default(''),
  sort: z.enum(['createdAt', 'appointmentDate', 'customerName', 'status']).default('createdAt'),
});
export const bookingPageSchema = pagedResponseSchema(bookingSummarySchema);
// Explicit public allowlist: never expose CRM/source, staff, Deal, price or notes.
export const bookingSelfSchema = bookingSummarySchema.pick({
  id: true, customerName: true, phone: true,
  roomUnitId: true, buildingId: true, buildingCode: true, buildingName: true,
  roomTypeId: true, roomTypeName: true, roomNumber: true,
  appointmentDate: true, appointmentTime: true, appointmentAt: true,
  appointmentTimezoneOffsetMinutes: true, status: true, createdAt: true,
}).strict();
export const bookingSelfPageSchema = pagedResponseSchema(bookingSelfSchema);
export const bookingReadSchema = z.union([bookingSummarySchema, bookingSelfSchema]);
export const bookingReadPageSchema = pagedResponseSchema(bookingReadSchema);
export const bookingSelfListQuerySchema = bookingListQuerySchema.omit({
  customerId: true, assignee: true,
}).strict();
export const bookingSelfLinkRequestSchema = z.object({
  userId: z.string().trim().min(1).max(160).nullable(),
  expectedUserId: z.string().trim().min(1).max(160).nullable(),
}).strict();
export const bookingSelfLinkSchema = z.object({
  id: z.string(), userId: z.string().nullable(),
}).strict();
export type BookingSelfListQuery = z.infer<typeof bookingSelfListQuerySchema>;
export type BookingSelfLinkRequest = z.infer<typeof bookingSelfLinkRequestSchema>;
export const bookingStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
});

export const bookingAssigneeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  roleCode: z.string(),
  roleName: z.string(),
  bookingScope: z.enum(['all', 'assigned']),
}).strict();
export const bookingAssigneeListSchema = z.array(bookingAssigneeSchema);
export const bookingAssigneeListQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
}).strict();

export const createBookingRequestSchema = z
  .object({
    customerName: z.string().trim().min(1, 'Họ tên không được để trống.').max(160),
    phone: z.string().trim().min(1, 'Số điện thoại không được để trống.').max(30),
    email: z.union([
      z.string().trim().email('Email không hợp lệ.'),
      z.literal(''),
    ]).optional().default(''),
    roomUnitId: z.string().trim().min(1, 'Vui lòng chọn căn cụ thể.').max(160),
    appointmentDate: bookingDateSchema,
    appointmentTime: bookingTimeSchema,
    appointmentTimezoneOffsetMinutes: z.number().int().min(-840).max(840),
    notes: z.string().trim().max(2000).optional().default(''),
    affiliateToken: affiliateTokenSchema.optional(),
  })
  .strict();

export const createAdminBookingRequestSchema = z
  .object({
    customerId: z.string().trim().min(1).max(160),
    roomUnitId: z.string().trim().min(1, 'Vui lòng chọn căn cụ thể.').max(160),
    appointmentDate: bookingDateSchema,
    appointmentTime: bookingTimeSchema,
    appointmentTimezoneOffsetMinutes: z.number().int().min(-840).max(840),
    notes: z.string().trim().max(2000).optional().default(''),
    assignedUserId: z.string().trim().min(1).max(160).nullable().optional().default(null),
  })
  .strict();

export const bookingTransitionRequestSchema = z
  .object({
    transition: bookingTransitionSchema,
  })
  .strict();

export const bookingRescheduleRequestSchema = z
  .object({
    appointmentDate: bookingDateSchema,
    appointmentTime: bookingTimeSchema,
    appointmentTimezoneOffsetMinutes: z.number().int().min(-840).max(840),
  })
  .strict();

export const bookingAssignmentRequestSchema = z
  .object({
    assignedUserId: z.string().trim().min(1).nullable(),
  })
  .strict();

export type CreateBookingRequest = z.infer<
  typeof createBookingRequestSchema
>;
export type CreateAdminBookingRequest = z.infer<
  typeof createAdminBookingRequestSchema
>;
export type BookingTransitionRequest = z.infer<
  typeof bookingTransitionRequestSchema
>;
export type BookingRescheduleRequest = z.infer<
  typeof bookingRescheduleRequestSchema
>;
export type BookingAssignmentRequest = z.infer<
  typeof bookingAssignmentRequestSchema
>;

export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;
export type BookingPublicReceipt = z.infer<typeof bookingPublicReceiptSchema>;
export type BookingSummary = z.infer<typeof bookingSummarySchema>;
export type BookingAssignee = z.infer<typeof bookingAssigneeSchema>;
export type BookingAssigneeListQuery = z.infer<typeof bookingAssigneeListQuerySchema>;
