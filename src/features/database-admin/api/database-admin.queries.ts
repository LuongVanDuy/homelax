import { useQuery } from '@tanstack/react-query';
import { databaseAdminApi } from './database-admin.api';

export const databaseAdminKeys = {
  all: ['database-admin'] as const,
  stats: ['database-admin', 'stats'] as const,
};

export function useDatabaseStatsQuery(enabled: boolean) {
  return useQuery({
    queryKey: databaseAdminKeys.stats,
    queryFn: databaseAdminApi.stats,
    enabled,
    staleTime: 15_000,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
  });
}
