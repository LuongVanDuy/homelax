import { useQuery } from '@tanstack/react-query';
import { rolePageSchema, roleSummarySchema, type RoleListQuery } from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { listQueryString } from '../../../lib/api/listQuery';
import { roleKeys } from './role.keys';

export type { RoleSummary } from '@tinyhouse/contracts';

async function fetchRolesPage(params: Partial<RoleListQuery>) {
  const data = await ApiClient.get(`/v2/roles${listQueryString(params)}`, { bypassCache: true });
  return rolePageSchema.parse(data);
}

export function useRolesPageQuery(params: Partial<RoleListQuery>, enabled = true) {
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: () => fetchRolesPage(params),
    staleTime: 30_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useRolesQuery(enabled = true) {
  const params = { page: 1, pageSize: 500, sort: 'createdAt', order: 'asc' } as const;
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: () => fetchRolesPage(params),
    select: (page) => page.items.map(({ userCount: _userCount, ...role }) => roleSummarySchema.parse(role)),
    staleTime: 30_000,
    refetchOnMount: 'always',
    enabled,
  });
}

export function useRoleQuery(id?: string) {
  return useQuery({
    queryKey: roleKeys.detail(id || ''),
    queryFn: async () => roleSummarySchema.parse(await ApiClient.get(
      `/v2/roles/${encodeURIComponent(id || '')}`,
      { bypassCache: true },
    )),
    enabled: Boolean(id),
  });
}
