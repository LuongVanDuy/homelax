import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authSessionResponseSchema, roleSummarySchema, roleWriteSchema, type RoleWrite, type RoleSummary } from '@tinyhouse/contracts';
import { z } from 'zod';
import { ApiClient } from '../../../services/apiClient';
import { IdentityStore } from '../../auth/identityStore';
import { userKeys } from '../../users/api/user.keys';
import { buildingKeys } from '../../buildings/api/building.keys';
import { roomKeys } from '../../rooms/api/room.keys';
import { bookingKeys } from '../../bookings/api/booking.keys';
import { roleKeys } from './role.keys';

async function refreshOwnRoleIdentity(role: RoleSummary, version: number) {
  const current = IdentityStore.get();
  if (current?.roleCode !== role.code || version !== ApiClient.getSessionVersion()) return false;
  try {
    const session = authSessionResponseSchema.parse(await ApiClient.get('/v2/auth/session', { bypassCache: true }));
    if (version === ApiClient.getSessionVersion() && IdentityStore.get()?.id === current.id && session.user.id === current.id) {
      ApiClient.acceptIdentity(session.user);
    }
    return false;
  } catch {
    return IdentityStore.get()?.id === current.id && version === ApiClient.getSessionVersion();
  }
}

function useRefreshRoleData() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    roleKeys.all, userKeys.all, buildingKeys.all, roomKeys.all, bookingKeys.all,
  ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useSaveRoleMutation() {
  const refresh = useRefreshRoleData();
  return useMutation({
    mutationFn: async (role: RoleWrite) => {
      const version = ApiClient.getSessionVersion();
      const saved = roleSummarySchema.parse(await ApiClient.post('/v2/roles', roleWriteSchema.parse(role)));
      return { role: saved, identityRefreshFailed: await refreshOwnRoleIdentity(saved, version) };
    },
    onSuccess: refresh,
  });
}

export function useUpdateRoleMutation() {
  const refresh = useRefreshRoleData();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: RoleWrite }) => {
      const version = ApiClient.getSessionVersion();
      const saved = roleSummarySchema.parse(await ApiClient.put(`/v2/roles/${encodeURIComponent(id)}`, roleWriteSchema.parse(role)));
      return { role: saved, identityRefreshFailed: await refreshOwnRoleIdentity(saved, version) };
    },
    onSuccess: refresh,
  });
}

export function useDeleteRoleMutation() {
  const refresh = useRefreshRoleData();
  return useMutation({
    mutationFn: async (id: string) => z.object({ success: z.literal(true), id: z.string() }).parse(
      await ApiClient.delete(`/v2/roles/${encodeURIComponent(id)}`),
    ),
    onSuccess: refresh,
  });
}
