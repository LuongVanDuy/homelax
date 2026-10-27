import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { intakeSummarySchema, intakePageSchema, intakeHistoryPageSchema, type IntakeListQuery, type IntakeUpdate } from '@tinyhouse/contracts';
import { ApiClient } from '../../services/apiClient';
import { accountSessionGuard } from '../account/api/account.api';
import { getIdentityScope, IdentityStore } from '../auth/identityStore';
import { listQueryString } from '../../lib/api/listQuery';

export function useIntakeList(params: Partial<IntakeListQuery>) {
  const guard = accountSessionGuard();
  return useQuery({ queryKey: ['intake', getIdentityScope(IdentityStore.get()), 'list', params], retry: false, placeholderData: previous => previous,
    queryFn: async () => { guard(); const data = await ApiClient.get(`/v2/intake-requests${listQueryString(params)}`, { bypassCache: true }); guard(); return intakePageSchema.parse(data); } });
}
export function useIntakeDetail(id: string) {
  const guard = accountSessionGuard();
  return useQuery({ queryKey: ['intake', getIdentityScope(IdentityStore.get()), id], retry: false, refetchOnWindowFocus: false,
    queryFn: async () => { guard(); const data = await ApiClient.get(`/v2/intake-requests/${encodeURIComponent(id)}`, { bypassCache: true }); guard(); return intakeSummarySchema.parse(data); } });
}
export function useIntakeHistory(id: string, page: number) {
  const guard = accountSessionGuard();
  return useQuery({ queryKey: ['intake', getIdentityScope(IdentityStore.get()), id, 'history', page], retry: false,
    queryFn: async () => { guard(); const data = await ApiClient.get(`/v2/intake-requests/${encodeURIComponent(id)}/history?page=${page}&pageSize=10`, { bypassCache: true }); guard(); return intakeHistoryPageSchema.parse(data); } });
}
export function useIntakeUpdate(id: string) {
  const client = useQueryClient();
  const scope = getIdentityScope(IdentityStore.get());
  const guard = accountSessionGuard();
  return useMutation({ retry: false,
    mutationFn: async (input: IntakeUpdate) => { guard(); const data = await ApiClient.patch(`/v2/intake-requests/${encodeURIComponent(id)}`, input); guard(); return intakeSummarySchema.parse(data); },
    onSuccess: data => {
      guard(); client.setQueryData(['intake', scope, id], data);
      void client.invalidateQueries({ queryKey: ['intake', scope] });
      void client.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}
