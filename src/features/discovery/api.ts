import { useQuery } from '@tanstack/react-query';
import { publicBuildingPageSchema, publicBuildingMapResultSchema, type BuildingListQuery, type PublicBuildingMapQuery } from '@tinyhouse/contracts';
import { ApiClient } from '../../services/apiClient';
import { listQueryString } from '../../lib/api/listQuery';

export async function fetchBuildingDiscovery(params: Partial<BuildingListQuery>) {
  return publicBuildingPageSchema.parse(await ApiClient.get(
    `/v2/buildings${listQueryString({ ...params, scope: 'public' })}`, { bypassCache: true },
  ));
}

export function useBuildingDiscoveryQuery(params: Partial<BuildingListQuery>, enabled = true) {
  return useQuery({ queryKey: ['buildings', 'public-discovery', params],
    queryFn: () => fetchBuildingDiscovery(params), enabled, staleTime: 0,
    refetchOnMount: 'always', refetchOnWindowFocus: true });
}

export async function fetchBuildingMap(params: PublicBuildingMapQuery) {
  return publicBuildingMapResultSchema.parse(await ApiClient.get(
    `/v2/buildings/map${listQueryString(params)}`, { bypassCache: true },
  ));
}

export function buildingMapQueryOptions(params: PublicBuildingMapQuery) {
  return {
    queryKey: ['buildings', 'public-map', params] as const,
    queryFn: () => fetchBuildingMap(params),
    staleTime: 0, refetchOnMount: 'always' as const, refetchOnWindowFocus: true,
    // Public reads can race identity bootstrap; discard that response and fetch the new session.
    retry: (attempt: number, error: unknown) => attempt < 1 && (error as { code?: string })?.code === 'SESSION_CHANGED',
    retryDelay: 150,
  };
}
export function useBuildingMapQuery(params: PublicBuildingMapQuery, enabled = true) {
  return useQuery({ ...buildingMapQueryOptions(params), enabled });
}
