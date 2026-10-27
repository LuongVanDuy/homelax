import { useQuery } from '@tanstack/react-query';
import {
  commissionHistoryBoundarySchema,
  commissionHistoryPageSchema,
  commissionMonthlyStatementSchema,
  commissionLedgerBoundarySchema,
  commissionLedgerNullableSchema,
  type CommissionHistoryQuery,
  type CommissionMonthlyStatementQuery,
} from '@tinyhouse/contracts';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';

export const commissionLedgerKeys = {
  all: ['commission-ledger'] as const,
  boundary: ['commission-ledger', 'boundary'] as const,
  historyBoundary: ['commission-ledger', 'history-boundary'] as const,
  history: (params: Partial<CommissionHistoryQuery>) => ['commission-ledger', 'history', params] as const,
  monthlyStatement: (params: Partial<CommissionMonthlyStatementQuery>) => ['commission-ledger', 'monthly-statement', params] as const,
  deal: (dealId: string) => ['commission-ledger', 'deal', dealId] as const,
};

export function useCommissionLedgerBoundaryQuery(enabled = true) {
  return useQuery({
    queryKey: commissionLedgerKeys.boundary,
    queryFn: async () => commissionLedgerBoundarySchema.parse(
      await ApiClient.get('/v2/commission-ledger/boundary', { bypassCache: true }),
    ),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCommissionHistoryBoundaryQuery(enabled = true) {
  return useQuery({
    queryKey: commissionLedgerKeys.historyBoundary,
    queryFn: async () => commissionHistoryBoundarySchema.parse(
      await ApiClient.get('/v2/commission-ledger/history-boundary', { bypassCache: true }),
    ),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCommissionHistoryQuery(
  params: Partial<CommissionHistoryQuery>,
  enabled = true,
) {
  return useQuery({
    queryKey: commissionLedgerKeys.history(params),
    queryFn: async () => commissionHistoryPageSchema.parse(
      await ApiClient.get(
        `/v2/commission-ledger/history${listQueryString(params)}`,
        { bypassCache: true },
      ),
    ),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useCommissionMonthlyStatementQuery(
  params: Partial<CommissionMonthlyStatementQuery>,
  enabled = true,
) {
  return useQuery({
    queryKey: commissionLedgerKeys.monthlyStatement(params),
    queryFn: async () => commissionMonthlyStatementSchema.parse(
      await ApiClient.get(
        `/v2/commission-ledger/monthly-statement${listQueryString(params)}`,
        { bypassCache: true },
      ),
    ),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useCommissionLedgerDealQuery(dealId: string, enabled = true) {
  return useQuery({
    queryKey: commissionLedgerKeys.deal(dealId),
    queryFn: async () => commissionLedgerNullableSchema.parse(
      await ApiClient.get(`/v2/commission-ledger/deals/${encodeURIComponent(dealId)}`, { bypassCache: true }),
    ),
    staleTime: 30_000,
    enabled: enabled && Boolean(dealId),
  });
}
