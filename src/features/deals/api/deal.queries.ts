import { useQuery } from '@tanstack/react-query';
import {
  dealAssigneeListSchema,
  dealFinanceBoundarySchema,
  dealPageSchema,
  dealRoomUnitHistorySchema,
  dealSummarySchema,
  type DealListQuery,
} from '@tinyhouse/contracts';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';
import { dealKeys } from './deal.keys';

export function useDealsPageQuery(params: Partial<DealListQuery>, enabled = true) {
  return useQuery({
    queryKey: dealKeys.list(params),
    queryFn: async () => dealPageSchema.parse(await ApiClient.get(
      `/v2/deals${listQueryString(params)}`,
      { bypassCache: true },
    )),
    staleTime: 30_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useDealAssigneesQuery(enabled = true) {
  return useQuery({
    queryKey: dealKeys.assignees(),
    queryFn: async () => dealAssigneeListSchema.parse(await ApiClient.get(
      '/v2/deals/assignees',
      { bypassCache: true },
    )),
    staleTime: 60_000,
    enabled,
  });
}

export function useDealFinanceBoundaryQuery(enabled = true) {
  return useQuery({
    queryKey: dealKeys.financeBoundary(),
    queryFn: async () => dealFinanceBoundarySchema.parse(await ApiClient.get(
      '/v2/deals/finance-boundary',
      { bypassCache: true },
    )),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useDealRoomUnitHistoryQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: dealKeys.roomHistory(id),
    queryFn: async () => dealRoomUnitHistorySchema.parse(await ApiClient.get(
      `/v2/deals/${encodeURIComponent(id)}/room-history`,
      { bypassCache: true },
    )),
    staleTime: 30_000,
    enabled: enabled && Boolean(id),
  });
}

export function useDealQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: dealKeys.detail(id),
    queryFn: async () => dealSummarySchema.parse(await ApiClient.get(
      `/v2/deals/${encodeURIComponent(id)}`,
      { bypassCache: true },
    )),
    staleTime: 30_000,
    enabled: enabled && Boolean(id),
  });
}
