export const roleKeys = {
  all: ['roles'] as const,
  list: (params: unknown = {}) => ['roles', 'list', params] as const,
  detail: (id: string) => ['roles', 'detail', id] as const,
};
