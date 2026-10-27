import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AmenityScope, PublicAmenity, PublicRoomTypeCatalog, PublicSchool } from '@tinyhouse/contracts';
import { fetchPublicSchoolsPage } from '../schools/api/school.queries';
import { fetchPublicAmenitiesPage } from '../amenities/api/amenity.queries';
import { fetchPublicRoomTypeCatalogPage } from '../room-types/api';
import { publicSchoolLabel } from '../schools/schoolPresentation';
import { AMENITY_CATEGORY_LABELS } from '../amenities/amenityPresentation';

export type CatalogKind = 'schools' | 'amenities' | 'roomTypes';
export type CatalogOption = { id: string; label: string; description: string; group: string; scope?: AmenityScope };
const schoolOption = (item: PublicSchool): CatalogOption => ({ id: item.id, label: publicSchoolLabel(item),
  description: `Bán kính ${item.effectiveRadiusKm.toLocaleString('vi-VN')} km`, group: '' });
const amenityOption = (item: PublicAmenity): CatalogOption => ({
  id: item.id, label: item.name, description: '', group: AMENITY_CATEGORY_LABELS[item.category], scope: item.scope,
});
const roomTypeOption = (item: PublicRoomTypeCatalog): CatalogOption => ({
  id: item.id, label: item.name, description: '', group: '',
});

async function fetchCatalog(kind: CatalogKind, params: { search?: string; ids?: string; scope?: AmenityScope; page?: number; pageSize: number }) {
  if (kind === 'schools') {
    const { scope: _scope, ...query } = params;
    const page = await fetchPublicSchoolsPage(query);
    return { ...page, items: page.items.map(schoolOption) };
  }
  if (kind === 'roomTypes') {
    const { scope: _scope, ...query } = params;
    const page = await fetchPublicRoomTypeCatalogPage(query);
    return { ...page, items: page.items.map(roomTypeOption) };
  }
  const page = await fetchPublicAmenitiesPage(params);
  return { ...page, items: page.items.map(amenityOption) };
}
export function useDiscoveryOptions(kind: CatalogKind, search: string, scope?: AmenityScope) {
  return useInfiniteQuery({ queryKey: [kind, 'public', 'discovery-options', scope || '', search],
    queryFn: ({ pageParam }) => fetchCatalog(kind, { search, scope, page: pageParam, pageSize: 30 }),
    initialPageParam: 1, getNextPageParam: page => page.pagination.page < page.pagination.totalPages ? page.pagination.page + 1 : undefined,
    staleTime: 60_000, refetchOnMount: 'always' });
}
export function useDiscoverySelected(kind: CatalogKind, ids: string[]) {
  const stableIds = [...ids].sort().join(',');
  return useQuery({ queryKey: [kind, 'public', 'discovery-selected', stableIds],
    queryFn: () => fetchCatalog(kind, { ids: stableIds, pageSize: 500 }),
    enabled: ids.length > 0, staleTime: 60_000, refetchOnMount: 'always' });
}

// Keep selected rows even when remote search/paging no longer includes them.
export function mergeCatalogOptions(options: CatalogOption[], selected: CatalogOption[]) {
  return [...new Map([...options, ...selected].map(option => [option.id, option])).values()]
    .sort((a, b) => a.group.localeCompare(b.group, 'vi'));
}
