import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  accountDetailSchema, accountLinkedProfilesPageSchema, accountActivityPageSchema,
  accountRelatedQuerySchema, accountProfileResultSchema, accountPasswordResultSchema,
  changePasswordRequestSchema, updateProfileRequestSchema, profileAvatarSchema,
  userProfileWriteSchema, userSummarySchema,
  type UpdateProfileRequest, type ChangePasswordRequest, type AccountUser,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { getIdentityScope, IdentityStore } from '../../auth/identityStore';

export const accountKeys = { all: ['account-center'] as const };

/** Capture both authorization scope and login generation; never reuse another session's response. */
export function accountSessionGuard() {
  const scope = getIdentityScope(IdentityStore.get());
  const version = ApiClient.getSessionVersion();
  return () => {
    if (!scope || getIdentityScope(IdentityStore.get()) !== scope || ApiClient.getSessionVersion() !== version) {
      throw Object.assign(new Error('Phiên đăng nhập đã thay đổi.'), { code: 'SESSION_CHANGED' });
    }
  };
}

function safeParse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(message);
  return parsed.data;
}

export function accountQueryOptions(userId?: string) {
  const guard = accountSessionGuard();
  const scope = getIdentityScope(IdentityStore.get());
  return {
    queryKey: [...accountKeys.all, scope, userId || 'self'] as const,
    queryFn: async () => {
      guard();
      const data = await ApiClient.get(userId ? `/v2/users/${encodeURIComponent(userId)}` : '/v2/auth/profile', { bypassCache: true });
      guard();
      const result = safeParse(accountDetailSchema, data, 'Không tải được tài khoản hoặc tài khoản không còn tồn tại.');
      if (result.user.id !== (userId || IdentityStore.get()?.id)) {
        throw new Error('Thông tin trả về không khớp tài khoản đang xem.');
      }
      return result;
    },
    staleTime: 15_000,
    refetchOnMount: 'always' as const,
    retry: false as const,
  };
}

export function useAccountDetailQuery(userId?: string, enabled = true) {
  return useQuery({ ...accountQueryOptions(userId), enabled });
}

function relatedOptions<T>(id: string, kind: 'activity' | 'linked-profiles', page: number, schema: z.ZodType<T>) {
  const guard = accountSessionGuard();
  const params = accountRelatedQuerySchema.parse({ page, pageSize: 10 });
  return {
    queryKey: [...accountKeys.all, getIdentityScope(IdentityStore.get()), id, kind, params],
    queryFn: async () => {
      guard();
      const response = await ApiClient.get(`/v2/users/${encodeURIComponent(id)}/${kind}?page=${params.page}&pageSize=${params.pageSize}`, { bypassCache: true });
      guard();
      return safeParse(schema, response, 'Không tải được thông tin liên quan. Vui lòng thử lại.');
    },
    staleTime: 15_000,
    retry: false as const,
  };
}
export function useAccountActivityQuery(id: string, page: number, enabled: boolean) {
  return useQuery({ ...relatedOptions(id, 'activity', page, accountActivityPageSchema), enabled });
}
export function useAccountLinksQuery(id: string, page: number, enabled: boolean) {
  return useQuery({ ...relatedOptions(id, 'linked-profiles', page, accountLinkedProfilesPageSchema), enabled });
}

export function useRefreshAccountData() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: accountKeys.all }),
    client.invalidateQueries({ queryKey: ['users'] }),
    client.invalidateQueries({ queryKey: ['audit-logs'] }),
    client.invalidateQueries({ queryKey: ['affiliate'] }),
    client.invalidateQueries({ queryKey: ['contacts'] }),
    client.invalidateQueries({ queryKey: ['commission-config', 'collaborators'] }),
  ]);
}

export async function saveAccountProfile(input: UpdateProfileRequest, target?: AccountUser) {
  const guard = accountSessionGuard();
  guard();
  if (target) {
    const payload = userProfileWriteSchema.parse({ ...input, id: target.id, email: target.email });
    const saved = safeParse(userSummarySchema, await ApiClient.post('/v2/users', payload), 'Máy chủ đã nhận yêu cầu lưu; hãy tải lại để kiểm tra kết quả.');
    guard();
    return saved;
  }
  const response = await ApiClient.post('/v2/auth/update-profile', updateProfileRequestSchema.parse(input));
  guard();
  const saved = safeParse(accountProfileResultSchema, response, 'Máy chủ đã nhận yêu cầu lưu; hãy tải lại để kiểm tra kết quả.');
  if (saved.user.id !== IdentityStore.get()?.id) throw new Error('Tài khoản trả về không đúng phiên hiện tại.');
  ApiClient.acceptIdentity(saved.user);
  return saved.user;
}

/** Passwords are not put in TanStack mutation variables/cache or persisted storage. */
export async function changeAccountPassword(input: ChangePasswordRequest) {
  const guard = accountSessionGuard();
  guard();
  const result = await ApiClient.post('/v2/auth/change-password', changePasswordRequestSchema.parse(input));
  guard();
  const safe = safeParse(accountPasswordResultSchema, result, 'Yêu cầu đổi mật khẩu đã gửi. Hãy đăng nhập lại để kiểm tra kết quả.');
  // End local auth immediately even when the logout HTTP response is unavailable.
  await ApiClient.logoutSession().catch(() => undefined);
  return safe;
}

export async function uploadAccountAvatar(file: File) {
  const guard = accountSessionGuard();
  guard();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Chọn ảnh JPG, PNG, WebP, GIF hoặc AVIF không quá 5 MB.');
  }
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
  guard();
  const result = await ApiClient.post('/v2/upload', { image, fileName: 'avatar' });
  guard();
  const parsed = z.object({ success: z.literal(true), url: profileAvatarSchema }).safeParse(result);
  if (!parsed.success) throw new Error('Không tải được ảnh đại diện.');
  return parsed.data.url;
}
