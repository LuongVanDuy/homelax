import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchPublicSchoolsPage } from '../../schools/api/school.queries';

export function useHomeSchoolsQuery() {
  const params = { pageSize: 6, sort: 'availableUnitCount', order: 'desc' } as const;
  const query = useInfiniteQuery({
    queryKey: ['schools', 'public', 'home', params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPublicSchoolsPage({ ...params, page: pageParam }),
    getNextPageParam: ({ pagination }) => pagination.page < pagination.totalPages ? pagination.page + 1 : undefined,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  return { ...query, data: query.data ? {
    items: [...new Map(query.data.pages.flatMap(page => page.items).map(item => [item.id, item])).values()],
    pagination: query.data.pages[0].pagination,
  } : undefined };
}
