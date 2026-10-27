import { useQuery } from '@tanstack/react-query';
import { userPageSchema, userStatsSchema, type UserListQuery } from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { listQueryString } from '../../../lib/api/listQuery';
import { userKeys } from './user.keys';

async function fetchUsersPage(params: Partial<UserListQuery>) {
  const data = await ApiClient.get(
    `/v2/users${listQueryString(params)}`,
    { bypassCache: true },
  );
  return userPageSchema.parse(data);
}

export function useUsersPageQuery(params: Partial<UserListQuery>, enabled = true) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsersPage(params),
    staleTime: 30_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useUsersQuery(enabled = true) {
  const params = { page: 1, pageSize: 500, sort: 'createdAt', order: 'desc' } as const;
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsersPage(params),
    select: (page) => page.items,
    staleTime: 30_000,
    refetchOnMount: 'always',
    enabled,
  });
}

export function useUserStatsQuery(enabled = true) {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: async () => userStatsSchema.parse(
      await ApiClient.get('/v2/users/stats', { bypassCache: true }),
    ),
    staleTime: 30_000,
    refetchOnMount: 'always',
    enabled,
  });
}
