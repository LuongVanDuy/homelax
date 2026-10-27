import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';
import { profileBirthDateSchema, profileGenderSchema, profilePhoneSchema } from './profile.js';

export const USER_STATUSES = [
  'Hoạt động',
  'Chờ duyệt',
  'Đã khóa',
  'Từ chối',
] as const;

export const userStatusSchema = z.enum(USER_STATUSES);

export const userListQuerySchema = listQueryBaseSchema.extend({
  roleCode: z.string().trim().max(64).default(''),
  status: z.string().trim().max(64).default(''),
  review: z.enum(['', 'pending']).default(''),
  sort: z.enum(['createdAt', 'updatedAt', 'name', 'email', 'role', 'status']).default('createdAt'),
});

export const userSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  roleCode: z.string(),
  roleName: z.string(),
  // Read historical/imported values without rejecting the entire user list.
  // All new writes use userStatusSchema below.
  status: z.string(),
  avatar: z.string(),
  authProvider: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const userPageSchema = pagedResponseSchema(userSummarySchema);
export const userStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
});

export const userProfileWriteSchema = z
  .object({
    id: z.string().trim().min(1),
    gender: profileGenderSchema.optional(),
    birthDate: profileBirthDateSchema.optional(),
    address: z.string().trim().max(1000).optional(),
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email(),
    phone: profilePhoneSchema.optional(),
    roleCode: z.string().trim().min(1).optional(),
    roleName: z.string().trim().optional(),
    status: userStatusSchema.optional(),
    avatar: z.string().optional(),
  })
  .strict();

export const provisionUserRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: profilePhoneSchema.optional(),
    password: z.string().min(8),
    roleCode: z.string().trim().min(1),
    roleName: z.string().trim().optional(),
    status: userStatusSchema.optional(),
    avatar: z.string().optional(),
  })
  .strict();

export const resetPasswordRequestSchema = z
  .object({
    newPassword: z.string().min(8),
  })
  .strict();

export const userStatusRequestSchema = z
  .object({
    status: userStatusSchema,
  })
  .strict();

export type UserProfileWrite = z.infer<
  typeof userProfileWriteSchema
>;
export type ProvisionUserRequest = z.infer<
  typeof provisionUserRequestSchema
>;
export type ResetPasswordRequest = z.infer<
  typeof resetPasswordRequestSchema
>;
export type UserStatusRequest = z.infer<
  typeof userStatusRequestSchema
>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type UserSummary = z.infer<typeof userSummarySchema>;

export type UserListQuery = z.infer<typeof userListQuerySchema>;
