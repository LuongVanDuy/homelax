import { useQuery } from '@tanstack/react-query';
import {
  bookingAssigneeListSchema,
  bookingPageSchema,
  bookingStatsSchema,
  bookingSummarySchema,
  bookingSelfPageSchema,
  bookingSelfSchema,
  type BookingSelfListQuery,
  type BookingListQuery,
} from '@tinyhouse/contracts';
import { listQueryString } from '../../../lib/api/listQuery';
import { ApiClient } from '../../../services/apiClient';
import { bookingKeys } from './booking.keys';
import { accountSessionGuard } from '../../account/api/account.api';

export function useSelfBookingQuery(userId: string, id: string) {
  const guard = accountSessionGuard();
  return useQuery({
    queryKey: ['bookings', 'self', userId, 'detail', id],
    enabled: Boolean(userId && id), retry: false, staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async () => {
      guard();
      const result = await ApiClient.get(`/v2/bookings/self/${encodeURIComponent(id)}`, { bypassCache: true });
      guard();
      return bookingSelfSchema.parse(result);
    },
  });
}

export function useSelfBookingsPageQuery(userId: string, params: Partial<BookingSelfListQuery>, enabled = true) {
  const guard = accountSessionGuard();
  return useQuery({
    queryKey: ['bookings', 'self', userId, params],
    queryFn: async () => {
      guard();
      const data = await ApiClient.get(`/v2/bookings/self${listQueryString(params)}`, { bypassCache: true });
      guard();
      return bookingSelfPageSchema.parse(data);
    },
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: enabled && Boolean(userId),
  });
}

async function fetchBookingsPage(params: Partial<BookingListQuery>) {
  return bookingPageSchema.parse(await ApiClient.get(
    `/v2/bookings${listQueryString(params)}`,
    { bypassCache: true },
  ));
}

export function useBookingsPageQuery(params: Partial<BookingListQuery>, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.list(params),
    queryFn: () => fetchBookingsPage(params),
    staleTime: 30_000,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useBookingAssigneesQuery(search = '', enabled = true) {
  return useQuery({
    queryKey: bookingKeys.assignees(search),
    queryFn: async () => bookingAssigneeListSchema.parse(await ApiClient.get(
      `/v2/bookings/assignees${listQueryString({ search })}`,
      { bypassCache: true },
    )),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useBookingQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => bookingSummarySchema.parse(await ApiClient.get(
      `/v2/bookings/${encodeURIComponent(id)}`,
      { bypassCache: true },
    )),
    staleTime: 30_000,
    enabled: enabled && Boolean(id),
  });
}

export function useBookingsQuery(enabled = true) {
  const params = { page: 1, pageSize: 500, sort: 'createdAt', order: 'desc' } as const;
  return useQuery({
    queryKey: bookingKeys.list(params),
    queryFn: () => fetchBookingsPage(params),
    select: (page) => page.items,
    staleTime: 30_000,
    refetchOnMount: 'always',
    enabled,
  });
}

export function useBookingStatsQuery(enabled = true) {
  return useQuery({
    queryKey: bookingKeys.stats(),
    queryFn: async () => bookingStatsSchema.parse(
      await ApiClient.get('/v2/bookings/stats', { bypassCache: true }),
    ),
    staleTime: 30_000,
    refetchOnMount: 'always',
    enabled,
  });
}
