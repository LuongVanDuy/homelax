import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildingViewPermissionsSchema, buildingWriteSchema, type BuildingViewPermissions, type BuildingWrite } from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { amenityKeys } from '../../amenities/api/amenity.keys';
import { buildingKeys } from './building.keys';

function useBuildingInvalidation() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: buildingKeys.all }),
    queryClient.invalidateQueries({ queryKey: amenityKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['rooms'] }),
    queryClient.invalidateQueries({ queryKey: ['schools', 'public'] }),
  ]);
}

export function useSaveBuildingMutation() {
  const invalidate = useBuildingInvalidation();

  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: BuildingWrite }) => {
      const body = buildingWriteSchema.parse(data);
      return id
        ? ApiClient.put(`/v2/buildings/${encodeURIComponent(id)}`, body)
        : ApiClient.post('/v2/buildings', body);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteBuildingMutation() {
  const invalidate = useBuildingInvalidation();

  return useMutation({
    mutationFn: (id: string) =>
      ApiClient.delete(`/v2/buildings/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export function useArchiveBuildingMutation() {
  const invalidate = useBuildingInvalidation();

  return useMutation({
    mutationFn: (id: string) =>
      ApiClient.post(`/v2/buildings/${encodeURIComponent(id)}/archive`, {}),
    onSuccess: invalidate,
  });
}

export function useRestoreBuildingMutation() {
  const invalidate = useBuildingInvalidation();

  return useMutation({
    mutationFn: (id: string) =>
      ApiClient.post(`/v2/buildings/${encodeURIComponent(id)}/restore`, {}),
    onSuccess: invalidate,
  });
}

export function useSaveBuildingPermissionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, viewerIds }: { id: string; viewerIds: string[] }) => {
      const body: BuildingViewPermissions = buildingViewPermissionsSchema.parse({ viewerIds });
      return ApiClient.put(`/v2/buildings/${encodeURIComponent(id)}/view-permissions`, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: buildingKeys.all }),
  });
}
