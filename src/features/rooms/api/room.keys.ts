export const roomKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomKeys.all, 'list'] as const,
  list: (params: unknown = {}) => [...roomKeys.lists(), params] as const,
  stats: (scope = 'cms') => ['rooms', 'stats', scope] as const,
  byBuilding: (buildingId: string, params: unknown = {}) => ['rooms', 'building', buildingId, params] as const,
  detail: (id: string, scope = 'public') => ['rooms', 'detail', id, scope] as const,
};
