export const userKeys = {
  all: ['users'] as const,
  list: (params: unknown = {}) => ['users', 'list', params] as const,
  stats: () => ['users', 'stats'] as const,
};
