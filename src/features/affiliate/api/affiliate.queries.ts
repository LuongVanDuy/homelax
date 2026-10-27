import { useQuery } from '@tanstack/react-query';
import {
  affiliateReferralSchema,
  ctvMyCustomersQuerySchema,
  ctvMyCustomersWorkspaceSchema,
  type CtvMyCustomersQuery,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';

export const affiliateKeys = {
  me: ['affiliate', 'me'] as const,
  myCustomers: (query: CtvMyCustomersQuery) => ['affiliate', 'me', 'customers', query] as const,
};

export function useAffiliateReferralQuery(enabled = true) {
  return useQuery({
    queryKey: affiliateKeys.me,
    queryFn: async () => affiliateReferralSchema.parse(
      await ApiClient.get('/v2/affiliate/me', { bypassCache: true }),
    ),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useMyAffiliateCustomersQuery(
  query: CtvMyCustomersQuery,
  enabled = true,
) {
  const parsed = ctvMyCustomersQuerySchema.parse(query);
  return useQuery({
    queryKey: affiliateKeys.myCustomers(parsed),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(parsed.page),
        pageSize: String(parsed.pageSize),
        search: parsed.search,
        stage: parsed.stage,
        sort: parsed.sort,
        order: parsed.order,
      });
      return ctvMyCustomersWorkspaceSchema.parse(
        await ApiClient.get(`/v2/affiliate/me/customers?${params.toString()}`, {
          bypassCache: true,
        }),
      );
    },
    staleTime: 30_000,
    enabled,
  });
}
