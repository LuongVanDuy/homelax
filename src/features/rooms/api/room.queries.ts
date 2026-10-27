import { useQuery } from '@tanstack/react-query';
import {
  roomPageSchema, roomStatsSchema, roomTypeSchema,
  publicRoomPageSchema, publicRoomTypeSchema,
  publicRoomSearchPageSchema,
  type PublicRoomSearchQuery,
  type RoomListQuery, type PublicRoomType, type RoomType,
} from '@tinyhouse/contracts';
import { expectObjectResponse } from '../../../lib/api/assertApiResponse';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';
import { roomKeys } from './room.keys';

export async function fetchPublicRoomSearch(params: Partial<PublicRoomSearchQuery> = {}) {
  return publicRoomSearchPageSchema.parse(await ApiClient.get(
    `/v2/rooms/search${listQueryString(params)}`, { bypassCache: true },
  ));
}

export function usePublicRoomSearchQuery(params: Partial<PublicRoomSearchQuery> = {}, enabled = true) {
  return useQuery({
    queryKey: ['rooms', 'public-search', params],
    queryFn: () => fetchPublicRoomSearch(params),
    staleTime: 60_000, refetchOnMount: 'always', enabled,
  });
}

// Compatibility for existing UI types only; these placeholders are not server data or authority.
function publicRoomRecord(room: PublicRoomType): RoomType {
  return {
    ...room,
    roomUnits: room.roomUnits.map((unit) => ({ ...unit, migrationSource: '', createdAt: null, updatedAt: null })),
  };
}

export async function fetchRoomsPage(params: Partial<RoomListQuery>) {
  const response = await ApiClient.get(`/v2/rooms${listQueryString(params)}`, { bypassCache: true });
  if (params.scope === 'cms') return roomPageSchema.parse(response);
  const data = publicRoomPageSchema.parse(response);
  return { ...data, items: data.items.map(publicRoomRecord) };
}

export async function fetchRoom(id: string, scope = 'public') {
  if (!id) return null;
  const data = await ApiClient.get(
    `/v2/rooms/${encodeURIComponent(id)}?scope=${encodeURIComponent(scope)}`,
    { bypassCache: true },
  );
  return scope === 'cms'
    ? roomTypeSchema.parse(expectObjectResponse(data, 'room detail'))
    : publicRoomRecord(publicRoomTypeSchema.parse(data));
}

export function useRoomsPageQuery(params: Partial<RoomListQuery>, enabled = true) {
  return useQuery({
    queryKey: roomKeys.list(params), queryFn: () => fetchRoomsPage(params),
    staleTime: 60_000, refetchOnMount: 'always',
    placeholderData: (previous, previousQuery) => {
      const previousScope = (previousQuery?.queryKey[2] as Partial<RoomListQuery> | undefined)?.scope || 'public';
      return previousScope === (params.scope || 'public') ? previous : undefined;
    },
    enabled,
  });
}

export function useRoomStatsQuery(enabled = true) {
  return useQuery({
    queryKey: roomKeys.stats(),
    queryFn: async () => roomStatsSchema.parse(await ApiClient.get('/v2/rooms/stats', { bypassCache: true })),
    staleTime: 30_000, refetchOnMount: 'always', enabled,
  });
}

export function useRoomsQuery(scope: 'public' | 'cms' = 'public', enabled = true) {
  const params = { scope, page: 1, pageSize: 500, sort: 'updatedAt', order: 'desc' } as const;
  return useQuery({
    queryKey: roomKeys.list(params), queryFn: () => fetchRoomsPage(params),
    select: (page) => page.items, staleTime: 60_000, refetchOnMount: 'always', enabled,
  });
}

export function useRoomsByBuildingQuery(buildingId?: string) {
  const params = { page: 1, pageSize: 500, scope: 'public', sort: 'updatedAt', order: 'desc' } as const;
  return useQuery({
    queryKey: roomKeys.byBuilding(buildingId || '', params),
    queryFn: async () => {
      const data = publicRoomPageSchema.parse(await ApiClient.get(
        `/v2/rooms/building/${encodeURIComponent(buildingId || '')}${listQueryString(params)}`,
        { bypassCache: true },
      ));
      return { ...data, items: data.items.map(publicRoomRecord) };
    },
    select: (page) => page.items,
    enabled: Boolean(buildingId), staleTime: 60_000, refetchOnMount: 'always',
  });
}

export function useRoomQuery(id?: string, scope = 'public') {
  return useQuery({
    queryKey: roomKeys.detail(id || '', scope), queryFn: () => fetchRoom(id || '', scope),
    enabled: Boolean(id), staleTime: 60_000, refetchOnMount: 'always',
  });
}
