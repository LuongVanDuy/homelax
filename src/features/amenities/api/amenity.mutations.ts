import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  amenitySchema,
  amenityWriteSchema,
  type AmenityWrite,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { buildingKeys } from '../../buildings/api/building.keys';
import { roomKeys } from '../../rooms/api/room.keys';
import { amenityKeys } from './amenity.keys';

function useAmenityInvalidation() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: amenityKeys.all }),
    queryClient.invalidateQueries({ queryKey: buildingKeys.all }),
    queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  ]);
}

export function useSaveAmenityMutation() {
  const invalidate = useAmenityInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: AmenityWrite }) => {
      const body = amenityWriteSchema.parse(data);
      const response = id
        ? await ApiClient.put(`/v2/amenities/${encodeURIComponent(id)}`, body)
        : await ApiClient.post('/v2/amenities', body);
      return amenitySchema.parse(response);
    },
    onSuccess: invalidate,
  });
}

export function useArchiveAmenityMutation() {
  const invalidate = useAmenityInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      amenitySchema.parse(await ApiClient.post(`/v2/amenities/${encodeURIComponent(id)}/archive`, {})),
    onSuccess: invalidate,
  });
}

export function useRestoreAmenityMutation() {
  const invalidate = useAmenityInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      amenitySchema.parse(await ApiClient.post(`/v2/amenities/${encodeURIComponent(id)}/restore`, {})),
    onSuccess: invalidate,
  });
}

export function useDeleteAmenityMutation() {
  const invalidate = useAmenityInvalidation();
  return useMutation({
    mutationFn: (id: string) => ApiClient.delete(`/v2/amenities/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}
