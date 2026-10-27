import { useQuery } from '@tanstack/react-query';
import { auditListQuerySchema, auditPageSchema, type AuditListQuery } from '@tinyhouse/contracts';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';
import { getIdentityScope, IdentityStore } from '../../auth/identityStore';
import { auditKeys } from './audit.keys';

/** Shared prefix stays compatible with mutations that invalidate audit-logs. */
export function auditPageQueryOptions(params: Partial<AuditListQuery>) {
  const query = auditListQuerySchema.parse(params);
  const scope = getIdentityScope(IdentityStore.get());
  const assertCurrentScope = () => {
    if (getIdentityScope(IdentityStore.get()) !== scope) {
      throw Object.assign(new Error('Phiên đăng nhập đã thay đổi.'), { code: 'SESSION_CHANGED' });
    }
  };
  return {
    queryKey: auditKeys.list(query, scope),
    queryFn: async () => {
      assertCurrentScope();
      const response = await ApiClient.get(
        `/v2/audit-logs${listQueryString(query)}`,
        { bypassCache: true },
      );
      assertCurrentScope();
      const parsed = auditPageSchema.safeParse(response);
      // Do not print Zod issues or raw audit metadata to the UI/log.
      if (!parsed.success) throw new Error('Không tải được nhật ký hoạt động. Vui lòng thử lại.');
      return parsed.data;
    },
    staleTime: 15_000,
    refetchOnMount: 'always' as const,
    retry: false as const,
  };
}

export function useAuditLogsPageQuery(
  params: Partial<AuditListQuery>,
  enabled = true,
) {
  return useQuery({
    ...auditPageQueryOptions(params),
    enabled,
  });
}
