export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (params: unknown = {}, identityScope: string | null = null) =>
    ['audit-logs', 'list', identityScope, params] as const,
};
