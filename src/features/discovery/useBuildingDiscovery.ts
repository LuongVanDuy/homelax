import { useEffect } from 'react';
import { usePublicSearch } from '../../app/router/usePublicSearch';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useBuildingDiscoveryQuery, useBuildingMapQuery } from './api';
import { buildingMapParams, buildingSearchParams } from './searchQuery';

export function useBuildingDiscovery() {
  const [filters, updateSearch] = usePublicSearch();
  const debounced = useDebouncedValue(filters.q, 350);
  const debouncing = debounced !== filters.q;
  const listEnabled = filters.view !== 'map';
  const mapEnabled = filters.view !== 'grid';
  const query = useBuildingDiscoveryQuery(buildingSearchParams(filters, debounced), listEnabled && !debouncing);
  const mapParams = buildingMapParams(filters, debounced);
  const mapQuery = useBuildingMapQuery(mapParams, mapEnabled && !debouncing);
  const lastPage = Math.max(1, query.data?.pagination.totalPages || 0);
  const outsidePage = listEnabled && query.isSuccess && !debouncing && filters.page > lastPage;
  useEffect(() => {
    if (outsidePage && !query.isFetching) updateSearch({ page: lastPage }, true);
  }, [outsidePage, query.isFetching, lastPage, updateSearch]);
  const pending = debouncing || query.isPending || outsidePage;
  // Never substitute a prior filter's markers while waiting for the new membership response.
  const mapPending = debouncing || mapQuery.isPending;
  return {
    filters, updateSearch, query, pending,
    items: pending || query.isError ? [] : query.data?.items || [],
    total: pending || query.isError ? 0 : query.data?.pagination.total || 0,
    mapQuery, mapPending, mapFilterKey: JSON.stringify(mapParams),
  };
}
