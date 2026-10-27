import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoritePageSchema, favoriteStateSchema, selfRentalPageSchema } from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { IdentityStore, getIdentityScope } from '../../auth/identityStore';
import { accountSessionGuard } from './account.api';

export function useSelfAccountPage(kind: 'favorites' | 'rentals', page: number) {
  const guard = accountSessionGuard();
  const scope = getIdentityScope(IdentityStore.get());
  return useQuery({
    queryKey: ['self-account', scope, kind, page], retry: false, staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async () => {
      guard();
      const value = await ApiClient.get(`/v2/account/self/${kind}?page=${page}&pageSize=12`, { bypassCache: true });
      guard();
      return kind === 'favorites' ? favoritePageSchema.parse(value) : selfRentalPageSchema.parse(value);
    },
  });
}

export function useFavorite(unitId: string, enabled = true) {
  const scope = getIdentityScope(IdentityStore.get());
  const guard = accountSessionGuard();
  const client = useQueryClient();
  const key = ['self-account', scope, 'favorite', unitId];
  const endpoint = `/v2/account/self/favorites/${encodeURIComponent(unitId)}`;
  const query = useQuery({
    queryKey: key, enabled: Boolean(scope && unitId && enabled), retry: false, staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async () => { guard(); const data = await ApiClient.get(endpoint, { bypassCache: true }); guard(); return favoriteStateSchema.parse(data); },
  });
  const mutation = useMutation({
    mutationFn: async (saved: boolean) => {
      guard();
      const value = saved ? await ApiClient.put(endpoint, {}) : await ApiClient.delete(endpoint);
      guard();
      return favoriteStateSchema.parse(value);
    },
    onSuccess: value => { guard(); client.setQueryData(key, value); },
    onSettled: () => { void client.invalidateQueries({ queryKey: ['self-account', scope] }); },
  });
  return { query, mutation };
}
