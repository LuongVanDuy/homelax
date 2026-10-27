import { useQuery } from '@tanstack/react-query';
import {
  amenityPageSchema,
  publicAmenityPageSchema,
  type AmenityListQuery,
  type AmenityScope,
  type PublicAmenityListQuery,
} from '@tinyhouse/contracts';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';
import { amenityKeys } from './amenity.keys';

async function fetchAmenitiesPage(params: Partial<AmenityListQuery>) {
  return amenityPageSchema.parse(await ApiClient.get(
    `/v2/amenities${listQueryString(params)}`,
    { bypassCache: true },
  ));
}

export async function fetchPublicAmenitiesPage(
  params: Partial<PublicAmenityListQuery> = {},
) {
  return publicAmenityPageSchema.parse(await ApiClient.get(
    `/v2/amenities/public${listQueryString(params)}`,
    { bypassCache: true },
  ));
}

export function usePublicAmenitiesPageQuery(
  params: Partial<PublicAmenityListQuery> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['amenities', 'public', params],
    queryFn: () => fetchPublicAmenitiesPage(params),
    staleTime: 60_000,
    refetchOnMount: 'always',
    enabled,
  });
}

export function useAmenitiesPageQuery(params: Partial<AmenityListQuery>, enabled = true) {
  return useQuery({
    queryKey: amenityKeys.list(params),
    queryFn: () => fetchAmenitiesPage(params),
    staleTime: 60_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useAmenitiesQuery(scope: AmenityScope | '' = '', status: 'all' | 'active' | 'archived' = 'all', enabled = true) {
  const params = {
    page: 1,
    pageSize: 500,
    scope,
    status: status === 'all' ? '' : status,
    sort: 'sortOrder',
    order: 'asc',
  } as const;
  return useQuery({
    queryKey: amenityKeys.list(params),
    queryFn: () => fetchAmenitiesPage(params),
    select: (page) => page.items,
    staleTime: 60_000,
    refetchOnMount: 'always',
    enabled,
  });
}
