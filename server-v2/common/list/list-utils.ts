export function pageOffset(page: number, pageSize: number) {
  return Math.max(0, (page - 1) * pageSize);
}

export function pageResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export function escapedLike(value: string) {
  return `%${String(value || '').replace(/[\\%_]/g, '\\$&')}%`;
}
