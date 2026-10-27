import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  publicSchoolPageSchema,
  schoolDistanceResultSchema,
  schoolPageSchema,
  type PublicSchoolListQuery,
  type SchoolListQuery,
} from '@tinyhouse/contracts';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';
import { schoolKeys } from './school.keys';

async function fetchSchoolsPage(params: Partial<SchoolListQuery>) {
  return schoolPageSchema.parse(await ApiClient.get(
    `/v2/schools${listQueryString(params)}`,
    { bypassCache: true },
  ));
}

export async function fetchPublicSchoolsPage(
  params: Partial<PublicSchoolListQuery> = {},
) {
  return publicSchoolPageSchema.parse(await ApiClient.get(
    `/v2/schools/public${listQueryString(params)}`,
    { bypassCache: true },
  ));
}

export function usePublicSchoolsPageQuery(
  params: Partial<PublicSchoolListQuery> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['schools', 'public', params],
    queryFn: () => fetchPublicSchoolsPage(params),
    staleTime: 60_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function usePublicSchoolOptionsQuery(search: string) {
  return useInfiniteQuery({
    queryKey: ['schools', 'public', 'options', search],
    queryFn: ({ pageParam }) => fetchPublicSchoolsPage({ search, page: pageParam, pageSize: 30 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.page < lastPage.pagination.totalPages
      ? lastPage.pagination.page + 1 : undefined,
    staleTime: 60_000,
  });
}

export function useSchoolsPageQuery(
  params: Partial<SchoolListQuery>,
  enabled = true,
) {
  return useQuery({
    queryKey: schoolKeys.list(params),
    queryFn: () => fetchSchoolsPage(params),
    staleTime: 60_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useSchoolDistancesQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: ['schools', 'building-distances', id],
    queryFn: async () => schoolDistanceResultSchema.parse(await ApiClient.get(
      `/v2/schools/${encodeURIComponent(id)}/building-distances`,
      { bypassCache: true },
    )),
    staleTime: 60_000,
    enabled: enabled && Boolean(id),
  });
}
