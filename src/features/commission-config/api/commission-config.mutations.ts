import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collaboratorTypeAssignmentSchema,
  collaboratorTypeSummarySchema,
  collaboratorTypeWriteSchema,
  commissionAllocationTargetSummarySchema,
  commissionAllocationTargetWriteSchema,
  commissionCollaboratorSummarySchema,
  type CollaboratorTypeAssignment,
  type CollaboratorTypeWrite,
  type CommissionAllocationTargetWrite,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { commissionConfigKeys } from './commission-config.queries';

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: commissionConfigKeys.types }),
    queryClient.invalidateQueries({ queryKey: commissionConfigKeys.collaborators }),
    queryClient.invalidateQueries({ queryKey: commissionConfigKeys.allocationTargets }),
    queryClient.invalidateQueries({ queryKey: commissionConfigKeys.allocationStatus }),
  ]);
}

export function useSaveCollaboratorTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id?: string; value: CollaboratorTypeWrite }) => {
      const payload = collaboratorTypeWriteSchema.parse(value);
      const response = id
        ? await ApiClient.put(`/v2/commission-config/collaborator-types/${encodeURIComponent(id)}`, payload)
        : await ApiClient.post('/v2/commission-config/collaborator-types', payload);
      return collaboratorTypeSummarySchema.parse(response);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useCollaboratorTypeLifecycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      collaboratorTypeSummarySchema.parse(await ApiClient.patch(
        `/v2/commission-config/collaborator-types/${encodeURIComponent(id)}/${archived ? 'archive' : 'restore'}`,
        {},
      )),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useAssignCollaboratorTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: CollaboratorTypeAssignment }) => {
      const payload = collaboratorTypeAssignmentSchema.parse(value);
      return commissionCollaboratorSummarySchema.parse(await ApiClient.patch(
        `/v2/commission-config/collaborators/${encodeURIComponent(id)}/type`,
        payload,
      ));
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSaveCommissionAllocationTargetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id?: string; value: CommissionAllocationTargetWrite }) => {
      const payload = commissionAllocationTargetWriteSchema.parse(value);
      const response = id
        ? await ApiClient.put(`/v2/commission-config/allocation-targets/${encodeURIComponent(id)}`, payload)
        : await ApiClient.post('/v2/commission-config/allocation-targets', payload);
      return commissionAllocationTargetSummarySchema.parse(response);
    },
    onSuccess: () => invalidate(queryClient),
  });
}
