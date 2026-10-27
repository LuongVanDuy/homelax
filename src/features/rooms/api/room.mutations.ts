import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  roomTypeSchema,
  roomTypeWriteSchema,
  roomUnitSchema,
  roomUnitWriteSchema,
  type RoomTypeWrite,
  type RoomUnitWrite,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { amenityKeys } from '../../amenities/api/amenity.keys';
import { buildingKeys } from '../../buildings/api/building.keys';
import { roomKeys } from './room.keys';

function useRoomInvalidation() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: roomKeys.all }),
    queryClient.invalidateQueries({ queryKey: buildingKeys.all }),
    queryClient.invalidateQueries({ queryKey: amenityKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['schools', 'public'] }),
  ]);
}

export function useSaveRoomMutation() {
  const invalidate = useRoomInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: RoomTypeWrite }) => {
      const body = roomTypeWriteSchema.parse(data);
      const response = id
        ? await ApiClient.put(`/v2/rooms/${encodeURIComponent(id)}`, body)
        : await ApiClient.post('/v2/rooms', body);
      return roomTypeSchema.parse(response);
    },
    onSuccess: invalidate,
  });
}

export function useCreateRoomUnitMutation() {
  const invalidate = useRoomInvalidation();
  return useMutation({
    mutationFn: async ({ roomTypeId, data }: { roomTypeId: string; data: RoomUnitWrite }) =>
      roomUnitSchema.parse(await ApiClient.post(
        `/v2/rooms/${encodeURIComponent(roomTypeId)}/units`,
        roomUnitWriteSchema.parse(data),
      )),
    onSuccess: invalidate,
  });
}

export function useUpdateRoomUnitMutation() {
  const invalidate = useRoomInvalidation();
  return useMutation({
    mutationFn: async ({ roomTypeId, unitId, data }: { roomTypeId: string; unitId: string; data: RoomUnitWrite }) =>
      roomUnitSchema.parse(await ApiClient.put(
        `/v2/rooms/${encodeURIComponent(roomTypeId)}/units/${encodeURIComponent(unitId)}`,
        roomUnitWriteSchema.parse(data),
      )),
    onSuccess: invalidate,
  });
}

export function useDeleteRoomUnitMutation() {
  const invalidate = useRoomInvalidation();
  return useMutation({
    mutationFn: ({ roomTypeId, unitId }: { roomTypeId: string; unitId: string }) =>
      ApiClient.delete(`/v2/rooms/${encodeURIComponent(roomTypeId)}/units/${encodeURIComponent(unitId)}`),
    onSuccess: invalidate,
  });
}

export function useDeleteRoomMutation() {
  const invalidate = useRoomInvalidation();
  return useMutation({
    mutationFn: (id: string) => ApiClient.delete(`/v2/rooms/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export function useArchiveRoomMutation() {
  const invalidate = useRoomInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      roomTypeSchema.parse(await ApiClient.post(`/v2/rooms/${encodeURIComponent(id)}/archive`, {})),
    onSuccess: invalidate,
  });
}

export function useRestoreRoomMutation() {
  const invalidate = useRoomInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      roomTypeSchema.parse(await ApiClient.post(`/v2/rooms/${encodeURIComponent(id)}/restore`, {})),
    onSuccess: invalidate,
  });
}
