export const schoolKeys = {
  all: ['schools'] as const,
  list: (params: unknown = {}) => ['schools', 'list', params] as const,
};
