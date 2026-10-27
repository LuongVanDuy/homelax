import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bookingAssignmentRequestSchema,
  bookingPublicReceiptSchema,
  bookingRescheduleRequestSchema,
  bookingSummarySchema,
  bookingTransitionRequestSchema,
  createAdminBookingRequestSchema,
  createBookingRequestSchema,
  type BookingAssignmentRequest,
  type BookingRescheduleRequest,
  type BookingTransitionRequest,
  type CreateAdminBookingRequest,
  type CreateBookingRequest,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { bookingKeys } from './booking.keys';

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (booking: CreateBookingRequest) => {
      const payload = createBookingRequestSchema.parse(booking);
      return bookingPublicReceiptSchema.parse(await ApiClient.post('/v2/bookings', payload));
    },
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

export function useCreateAdminBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (booking: CreateAdminBookingRequest) => {
      const payload = createAdminBookingRequestSchema.parse(booking);
      return bookingSummarySchema.parse(await ApiClient.post('/v2/bookings/admin', payload));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

export function useAssignBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, assignment }: { id: string; assignment: BookingAssignmentRequest }) => {
      const payload = bookingAssignmentRequestSchema.parse(assignment);
      return bookingSummarySchema.parse(await ApiClient.patch(
        `/v2/bookings/${encodeURIComponent(id)}/assignment`,
        payload,
      ));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

export function useRescheduleBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, schedule }: { id: string; schedule: BookingRescheduleRequest }) => {
      const payload = bookingRescheduleRequestSchema.parse(schedule);
      return bookingSummarySchema.parse(await ApiClient.patch(
        `/v2/bookings/${encodeURIComponent(id)}/reschedule`,
        payload,
      ));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

export function useTransitionBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, command }: { id: string; command: BookingTransitionRequest }) => {
      const payload = bookingTransitionRequestSchema.parse(command);
      return bookingSummarySchema.parse(await ApiClient.patch(
        `/v2/bookings/${encodeURIComponent(id)}/transition`,
        payload,
      ));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  });
}

