export const buildingKeys = {
  all: ['buildings'] as const,
  list: (params: unknown = {}) => ['buildings', 'list', params] as const,
  stats: (scope = 'cms') => ['buildings', 'stats', scope] as const,
  detail: (id: string, scope = 'public') => ['buildings', 'detail', id, scope] as const,
};
