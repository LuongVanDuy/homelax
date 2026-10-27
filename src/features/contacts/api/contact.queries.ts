import { useQuery } from '@tanstack/react-query';
import {
  collaboratorPageSchema,
  customerPageSchema,
  type ContactListQuery,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { listQueryString } from '../../../lib/api/listQuery';
import { contactKeys, type ContactKind } from './contact.keys';

export type { CustomerSummary, CollaboratorSummary } from '@tinyhouse/contracts';

async function fetchContactsPage(kind: ContactKind, params: Partial<ContactListQuery>) {
  const result = await ApiClient.get(`/v2/${kind}${listQueryString(params)}`, { bypassCache: true });
  return kind === 'customers'
    ? customerPageSchema.parse(result)
    : collaboratorPageSchema.parse(result);
}

export function useContactsPageQuery(
  kind: ContactKind,
  params: Partial<ContactListQuery>,
  enabled = true,
) {
  return useQuery({
    queryKey: contactKeys.list(kind, params),
    queryFn: () => fetchContactsPage(kind, params),
    staleTime: 30_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useContactsQuery(kind: ContactKind, enabled = true) {
  const params = { page: 1, pageSize: 500, archived: 'all', sort: 'createdAt', order: 'desc' } as const;
  return useQuery({
    queryKey: contactKeys.list(kind, params),
    queryFn: () => fetchContactsPage(kind, params),
    select: (page) => page.items,
    staleTime: 30_000,
    refetchOnMount: 'always',
    enabled,
  });
}
