import { useQuery } from '@tanstack/react-query';
import { fetchHanoiWards } from './hanoiWards';

export function useHanoiWards() {
  return useQuery({
    queryKey: ['locations', 'hanoi', 'wards', 'v2'],
    queryFn: ({ signal }) => fetchHanoiWards(signal),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
