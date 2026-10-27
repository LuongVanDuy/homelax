export const dealKeys = {
  all: ['deals'] as const,
  list: (params: unknown = {}) => ['deals', 'list', params] as const,
  detail: (id: string) => ['deals', 'detail', id] as const,
  assignees: () => ['deals', 'assignees'] as const,
  financeBoundary: () => ['deals', 'finance-boundary'] as const,
  roomHistory: (id: string) => ['deals', 'room-history', id] as const,
};
