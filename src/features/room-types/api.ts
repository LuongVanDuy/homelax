import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  publicRoomTypeCatalogPageSchema,
  roomTypeCatalogPageSchema,
  roomTypeCatalogSchema,
  roomTypeCatalogWriteSchema,
  type PublicRoomTypeCatalogListQuery,
  type RoomTypeCatalogListQuery,
  type RoomTypeCatalogWrite,
} from '@tinyhouse/contracts';
import { listQueryString } from '../../lib/api/listQuery';
import { ApiClient } from '../../services/apiClient';
import { roomKeys } from '../rooms/api/room.keys';

export const roomTypeCatalogKeys = {
  all: ['room-type-catalog'] as const,
  list: (params: Partial<RoomTypeCatalogListQuery>) => ['room-type-catalog', 'list', params] as const,
  public: (params: Partial<PublicRoomTypeCatalogListQuery>) => ['room-type-catalog', 'public', params] as const,
};

export async function fetchRoomTypeCatalogPage(params: Partial<RoomTypeCatalogListQuery> = {}) {
  return roomTypeCatalogPageSchema.parse(await ApiClient.get(
    `/v2/room-types${listQueryString(params)}`, { bypassCache: true },
  ));
}

export async function fetchPublicRoomTypeCatalogPage(params: Partial<PublicRoomTypeCatalogListQuery> = {}) {
  return publicRoomTypeCatalogPageSchema.parse(await ApiClient.get(
    `/v2/room-types/public${listQueryString(params)}`, { bypassCache: true },
  ));
}

export function useRoomTypeCatalogPageQuery(params: Partial<RoomTypeCatalogListQuery>, enabled = true) {
  return useQuery({
    queryKey: roomTypeCatalogKeys.list(params),
    queryFn: () => fetchRoomTypeCatalogPage(params),
    staleTime: 60_000,
    refetchOnMount: 'always',
    placeholderData: previous => previous,
    enabled,
  });
}

export function usePublicRoomTypeCatalogPageQuery(params: Partial<PublicRoomTypeCatalogListQuery> = {}, enabled = true) {
  return useQuery({
    queryKey: roomTypeCatalogKeys.public(params),
    queryFn: () => fetchPublicRoomTypeCatalogPage(params),
    staleTime: 60_000,
    refetchOnMount: 'always',
    enabled,
  });
}

function useCatalogInvalidation() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: roomTypeCatalogKeys.all }),
    client.invalidateQueries({ queryKey: roomKeys.all }),
    client.invalidateQueries({ queryKey: ['buildings', 'public-discovery'] }),
    client.invalidateQueries({ queryKey: ['buildings', 'public-map'] }),
    client.invalidateQueries({ queryKey: ['rooms', 'public-search'] }),
  ]);
}

export function useSaveRoomTypeCatalogMutation() {
  const invalidate = useCatalogInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: RoomTypeCatalogWrite }) => {
      const body = roomTypeCatalogWriteSchema.parse(data);
      const response = id
        ? await ApiClient.put(`/v2/room-types/${encodeURIComponent(id)}`, body)
        : await ApiClient.post('/v2/room-types', body);
      return roomTypeCatalogSchema.parse(response);
    },
    onSuccess: invalidate,
  });
}

export function useArchiveRoomTypeCatalogMutation() {
  const invalidate = useCatalogInvalidation();
  return useMutation({
    mutationFn: async (id: string) => roomTypeCatalogSchema.parse(
      await ApiClient.post(`/v2/room-types/${encodeURIComponent(id)}/archive`, {}),
    ),
    onSuccess: invalidate,
  });
}

export function useRestoreRoomTypeCatalogMutation() {
  const invalidate = useCatalogInvalidation();
  return useMutation({
    mutationFn: async (id: string) => roomTypeCatalogSchema.parse(
      await ApiClient.post(`/v2/room-types/${encodeURIComponent(id)}/restore`, {}),
    ),
    onSuccess: invalidate,
  });
}

export function useDeleteRoomTypeCatalogMutation() {
  const invalidate = useCatalogInvalidation();
  return useMutation({
    mutationFn: (id: string) => ApiClient.delete(`/v2/room-types/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}
