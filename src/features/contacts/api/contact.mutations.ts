import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collaboratorSummarySchema, collaboratorWriteSchema, customerSummarySchema, customerWriteSchema,
  type CollaboratorWrite, type CustomerWrite,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { contactKeys, type ContactKind } from './contact.keys';

function parseContact(kind: ContactKind, value: unknown) {
  return kind === 'customers' ? customerSummarySchema.parse(value) : collaboratorSummarySchema.parse(value);
}

export function useSaveContactMutation(kind: ContactKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: CustomerWrite | CollaboratorWrite }) => {
      const payload = kind === 'customers' ? customerWriteSchema.parse(data) : collaboratorWriteSchema.parse(data);
      const result = id
        ? await ApiClient.put(`/v2/${kind}/${encodeURIComponent(id)}`, payload)
        : await ApiClient.post(`/v2/${kind}`, payload);
      return parseContact(kind, result);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactKeys.resource(kind) }),
  });
}

export function useContactArchiveMutation(kind: ContactKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => parseContact(kind,
      await ApiClient.post(`/v2/${kind}/${encodeURIComponent(id)}/${archive ? 'archive' : 'restore'}`, {}),
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactKeys.resource(kind) }),
  });
}
