import { useQuery } from '@tanstack/react-query';
import {
  collaboratorTypeListSchema,
  commissionAllocationStatusSchema,
  commissionAllocationTargetListSchema,
  commissionCollaboratorListSchema,
  commissionConfigBoundarySchema,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';

export const commissionConfigKeys = {
  all: ['commission-config'] as const,
  boundary: ['commission-config', 'boundary'] as const,
  types: ['commission-config', 'types'] as const,
  collaborators: ['commission-config', 'collaborators'] as const,
  allocationTargets: ['commission-config', 'allocation-targets'] as const,
  allocationStatus: ['commission-config', 'allocation-status'] as const,
};

export function useCommissionConfigBoundaryQuery() {
  return useQuery({
    queryKey: commissionConfigKeys.boundary,
    queryFn: async () => commissionConfigBoundarySchema.parse(
      await ApiClient.get('/v2/commission-config/boundary', { bypassCache: true }),
    ),
    staleTime: 5 * 60_000,
  });
}

export function useCollaboratorTypesQuery(enabled = true) {
  return useQuery({
    queryKey: commissionConfigKeys.types,
    queryFn: async () => collaboratorTypeListSchema.parse(
      await ApiClient.get('/v2/commission-config/collaborator-types', { bypassCache: true }),
    ),
    staleTime: 60_000,
    enabled,
  });
}

export function useCommissionCollaboratorsQuery(enabled = true) {
  return useQuery({
    queryKey: commissionConfigKeys.collaborators,
    queryFn: async () => commissionCollaboratorListSchema.parse(
      await ApiClient.get('/v2/commission-config/collaborators', { bypassCache: true }),
    ),
    staleTime: 60_000,
    enabled,
  });
}

export function useCommissionAllocationTargetsQuery(enabled = true) {
  return useQuery({
    queryKey: commissionConfigKeys.allocationTargets,
    queryFn: async () => commissionAllocationTargetListSchema.parse(
      await ApiClient.get('/v2/commission-config/allocation-targets', { bypassCache: true }),
    ),
    staleTime: 30_000,
    enabled,
  });
}

export function useCommissionAllocationStatusQuery(enabled = true) {
  return useQuery({
    queryKey: commissionConfigKeys.allocationStatus,
    queryFn: async () => commissionAllocationStatusSchema.parse(
      await ApiClient.get('/v2/commission-config/allocation-status', { bypassCache: true }),
    ),
    staleTime: 30_000,
    enabled,
  });
}
