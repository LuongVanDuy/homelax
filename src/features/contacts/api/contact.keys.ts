export type ContactKind = 'customers' | 'collaborators';

export const contactKeys = {
  all: ['contacts'] as const,
  resource: (kind: ContactKind) => ['contacts', kind] as const,
  list: (kind: ContactKind, params: unknown = {}) => ['contacts', kind, 'list', params] as const,
};
