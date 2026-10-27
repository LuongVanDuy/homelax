import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  authSessionResponseSchema, provisionUserRequestSchema, resetPasswordRequestSchema, userProfileWriteSchema,
  userStatusRequestSchema, userSummarySchema,
  type ProvisionUserRequest, type UserProfileWrite, type UserStatus,
} from '@tinyhouse/contracts';
import { z } from 'zod';
import { ApiClient } from '../../../services/apiClient';
import { IdentityStore } from '../../auth/identityStore';
import { contactKeys } from '../../contacts/api/contact.keys';
import { roleKeys } from '../../roles/api/role.keys';
import { userKeys } from './user.keys';

const userResultSchema = z.object({ success: z.literal(true), user: userSummarySchema });

function useRefreshUserData() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: userKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['account-center'] }),
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] }),
    queryClient.invalidateQueries({ queryKey: roleKeys.all }),
    queryClient.invalidateQueries({ queryKey: contactKeys.resource('collaborators') }),
  ]);
}

export function useSaveUserMutation() {
  const refresh = useRefreshUserData();
  return useMutation({
    mutationFn: async (user: UserProfileWrite) => {
      const version = ApiClient.getSessionVersion();
      const saved = userSummarySchema.parse(await ApiClient.post('/v2/users', userProfileWriteSchema.parse(user)));
      const current = IdentityStore.get();
      let identityRefreshFailed = false;
      if (current?.id === saved.id && version === ApiClient.getSessionVersion()) {
        try {
          const session = authSessionResponseSchema.parse(await ApiClient.get('/v2/auth/session', { bypassCache: true }));
          if (session.user.id === saved.id && IdentityStore.get()?.id === saved.id && version === ApiClient.getSessionVersion()) {
            IdentityStore.set(session.user);
          }
        } catch {
          // The write already succeeded; a refresh failure must not invite a duplicate save.
          identityRefreshFailed = IdentityStore.get()?.id === saved.id && version === ApiClient.getSessionVersion();
        }
      }
      return { user: saved, identityRefreshFailed };
    },
    onSuccess: refresh,
  });
}

export function useProvisionUserMutation() {
  const refresh = useRefreshUserData();
  return useMutation({
    mutationFn: async (user: ProvisionUserRequest) => userResultSchema.parse(
      await ApiClient.post('/v2/users/provision', provisionUserRequestSchema.parse(user)),
    ).user,
    onSuccess: refresh,
  });
}

export function useUserStatusMutation() {
  const refresh = useRefreshUserData();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UserStatus }) => userResultSchema.parse(
      await ApiClient.patch(`/v2/users/${encodeURIComponent(id)}/status`, userStatusRequestSchema.parse({ status })),
    ).user,
    onSuccess: refresh,
  });
}

export function useResetUserPasswordMutation() {
  const refresh = useRefreshUserData();
  return useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => z.object({
      success: z.literal(true), message: z.string(), userId: z.string(),
    }).parse(await ApiClient.post(`/v2/users/${encodeURIComponent(id)}/reset-password`, resetPasswordRequestSchema.parse({ newPassword }))),
    onSuccess: refresh,
  });
}

export function useDeleteUserMutation() {
  const refresh = useRefreshUserData();
  return useMutation({
    mutationFn: async (id: string) => z.object({ success: z.literal(true), id: z.string() }).parse(
      await ApiClient.delete(`/v2/users/${encodeURIComponent(id)}`),
    ),
    onSuccess: refresh,
  });
}
