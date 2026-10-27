export const bookingKeys = {
  all: ['bookings'] as const,
  list: (params: unknown = {}) => ['bookings', 'list', params] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  assignees: (search = '') => ['bookings', 'assignees', search] as const,
  stats: () => ['bookings', 'stats'] as const,
};
