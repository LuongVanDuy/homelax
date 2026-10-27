import { useQuery } from '@tanstack/react-query';
import {
  buildingPageSchema, buildingStatsSchema, publicBuildingPageSchema,
  publicBuildingDetailSchema, type BuildingListQuery,
} from '@tinyhouse/contracts';
import { expectObjectResponse } from '../../../lib/api/assertApiResponse';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';
import { buildingKeys } from './building.keys';
import { toBuildingRecord } from '../building.types';

export async function fetchBuildingsPage(params: Partial<BuildingListQuery>) {
  const response = await ApiClient.get(`/v2/buildings${listQueryString(params)}`, { bypassCache: true });
  const data = params.scope === 'cms'
    ? buildingPageSchema.parse(response) : publicBuildingPageSchema.parse(response);
  // Existing JSX/admin consumers share this local record type. Public input was already strictly parsed.
  return { ...data, items: data.items.map(toBuildingRecord) };
}

export async function fetchBuilding(id: string, scope = 'public') {
  if (!id) return null;
  const data = await ApiClient.get(
    `/v2/buildings/${encodeURIComponent(id)}?scope=${encodeURIComponent(scope)}`,
    { bypassCache: true },
  );
  return toBuildingRecord(scope === 'cms'
    ? expectObjectResponse(data, 'building detail') : publicBuildingDetailSchema.parse(data));
}

export function useBuildingsPageQuery(params: Partial<BuildingListQuery>, enabled = true) {
  return useQuery({
    queryKey: buildingKeys.list(params),
    queryFn: () => fetchBuildingsPage(params),
    staleTime: 60_000,
    refetchOnMount: 'always',
    placeholderData: (previous, previousQuery) => {
      const previousScope = (previousQuery?.queryKey[2] as Partial<BuildingListQuery> | undefined)?.scope || 'public';
      return previousScope === (params.scope || 'public') ? previous : undefined;
    },
    enabled,
  });
}

export function useBuildingStatsQuery(enabled = true) {
  return useQuery({
    queryKey: buildingKeys.stats(),
    queryFn: async () => buildingStatsSchema.parse(await ApiClient.get('/v2/buildings/stats', { bypassCache: true })),
    staleTime: 30_000, refetchOnMount: 'always', enabled,
  });
}

export function useBuildingsQuery(scope: 'public' | 'cms' = 'public', enabled = true) {
  const params = { scope, page: 1, pageSize: 500, sort: 'updatedAt', order: 'desc' } as const;
  return useQuery({
    queryKey: buildingKeys.list(params), queryFn: () => fetchBuildingsPage(params),
    select: (page) => page.items,
    staleTime: 60_000, refetchOnMount: 'always', enabled,
  });
}

export function useBuildingQuery(id?: string, scope = 'public') {
  return useQuery({
    queryKey: buildingKeys.detail(id || '', scope),
    queryFn: () => fetchBuilding(id || '', scope),
    enabled: Boolean(id), staleTime: 60_000, refetchOnMount: 'always',
  });
}
