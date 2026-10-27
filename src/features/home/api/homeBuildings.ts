import { useQuery } from '@tanstack/react-query';
import { publicBuildingPageSchema } from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { listQueryString } from '../../../lib/api/listQuery';

export const homeBuildingsParams = {
  scope: 'public', availability: 'available', status: 'active',
  page: 1, pageSize: 9, sort: 'smart', order: 'desc',
} as const;

export function useHomeBuildingsQuery() {
  return useQuery({
    // Under the building root so existing inventory mutations invalidate this block too.
    queryKey: ['buildings', 'home-available', homeBuildingsParams],
    queryFn: async () => publicBuildingPageSchema.parse(await ApiClient.get(
      `/v2/buildings${listQueryString(homeBuildingsParams)}`, { bypassCache: true },
    )),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
