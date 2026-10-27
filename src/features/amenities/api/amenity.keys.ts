export const amenityKeys = {
  all: ['amenities'] as const,
  list: (params: unknown = {}) => ['amenities', 'list', params] as const,
};
