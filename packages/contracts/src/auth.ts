import { z } from 'zod';
import { bookingScopeSchema, dealScopeSchema } from './roles.js';
import { personalProfileShape, profilePhoneSchema, normalizeAccountPhone } from './profile.js';

export const appIdentitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string(),
  phone: z.string().optional(),
  roleCode: z.string().min(1),
  roleName: z.string().min(1),
  status: z.string().min(1),
  avatar: z.string().optional(),
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
  authMode: z.literal('postgres'),
});

export const loginRequestSchema = z
  .object({
    email: z.string().trim().min(1),
    password: z.string().min(1),
  })
  .strict();

export const registerRequestSchema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(200),
    email: z.string().trim().email('Email chưa đúng định dạng.').max(254),
    phone: profilePhoneSchema.refine(value => normalizeAccountPhone(value).length >= 6, 'Vui lòng nhập số điện thoại hợp lệ.'),
    password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự.').max(128),
    gender: personalProfileShape.gender,
    birthDate: personalProfileShape.birthDate,
    address: personalProfileShape.address,
    // Upload is part of registration; no anonymous generic upload or remote URL.
    avatarImage: z.string().max(7_000_000).regex(/^data:image\/(?:jpeg|png|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/, 'Ảnh đại diện không hợp lệ.').optional(),
  })
  .strict();

export const registerResponseSchema = z.object({ success: z.literal(true), user: appIdentitySchema });

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().email('Email chưa đúng định dạng.').max(254),
}).strict();

export const publicResetPasswordRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{64}$/, 'Link khôi phục không hợp lệ.'),
  newPassword: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự.').max(128),
}).strict();

export const forgotPasswordResponseSchema = z.object({
  success: z.literal(true), message: z.string(), retryAfterSeconds: z.number().int().nonnegative(),
});
export const resetPasswordResponseSchema = z.object({ success: z.literal(true), message: z.string() });
export const verifyEmailRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{64}$/, 'Liên kết xác thực không hợp lệ.'),
}).strict();
export const requestVerificationSchema = z.object({}).strict();
export const requestVerificationResponseSchema = forgotPasswordResponseSchema;
export const verifyEmailResponseSchema = resetPasswordResponseSchema;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type PublicResetPasswordRequest = z.infer<typeof publicResetPasswordRequestSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  })
  .strict();

export const updateProfileRequestSchema = z.object({
  ...personalProfileShape,
  // Kept for the public consumer until its separate migration. Atomic on server.
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).optional(),
}).strict().refine(
  (data) => Object.entries(data).some(([key, value]) => key !== 'currentPassword' && value !== undefined),
  { message: 'Vui lòng cập nhật ít nhất một thông tin.' },
).refine(
  (data) => !data.newPassword || Boolean(data.currentPassword),
  { path: ['currentPassword'], message: 'Vui lòng nhập mật khẩu hiện tại.' },
);

export const authSessionResponseSchema = z.object({
  success: z.literal(true),
  authMode: z.literal('postgres'),
  accessToken: z.string().min(1).optional(),
  user: appIdentitySchema,
});

export type AppIdentityContract = z.infer<
  typeof appIdentitySchema
>;
export type LoginRequest = z.infer<
  typeof loginRequestSchema
>;
export type RegisterRequest = z.infer<
  typeof registerRequestSchema
>;

export type ChangePasswordRequest = z.infer<
  typeof changePasswordRequestSchema
>;
export type UpdateProfileRequest = z.infer<
  typeof updateProfileRequestSchema
>;
export type AuthSessionResponse = z.infer<
  typeof authSessionResponseSchema
>;
