import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cancelDealRequestSchema,
  changeDealRoomUnitRequestSchema,
  createDealDirectRequestSchema,
  createDealFromBookingRequestSchema,
  dealAssignmentRequestSchema,
  dealNoteRequestSchema,
  dealSummarySchema,
  updateDealCommercialTermsRequestSchema,
  updateDealContractDepositRequestSchema,
  updateDealRentalScheduleRequestSchema,
  type CancelDealRequest,
  type ChangeDealRoomUnitRequest,
  type CreateDealDirectRequest,
  type CreateDealFromBookingRequest,
  type DealAssignmentRequest,
  type DealNoteRequest,
  type UpdateDealCommercialTermsRequest,
  type UpdateDealContractDepositRequest,
  type UpdateDealRentalScheduleRequest,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { dealKeys } from './deal.keys';

export function useCancelDealMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cancel }: { id: string; cancel: CancelDealRequest }) => {
      const payload = cancelDealRequestSchema.parse(cancel);
      return dealSummarySchema.parse(await ApiClient.patch(
        `/v2/deals/${encodeURIComponent(id)}/cancel`,
        payload,
      ));
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(dealKeys.detail(deal.id), deal);
      return queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useAssignDealMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignment }: { id: string; assignment: DealAssignmentRequest }) => {
      const payload = dealAssignmentRequestSchema.parse(assignment);
      return dealSummarySchema.parse(await ApiClient.patch(
        `/v2/deals/${encodeURIComponent(id)}/assignment`,
        payload,
      ));
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(dealKeys.detail(deal.id), deal);
      return queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useAddDealNoteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: DealNoteRequest }) => {
      const payload = dealNoteRequestSchema.parse(note);
      return dealSummarySchema.parse(await ApiClient.patch(
        `/v2/deals/${encodeURIComponent(id)}/notes`,
        payload,
      ));
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(dealKeys.detail(deal.id), deal);
      return queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useChangeDealRoomUnitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change }: { id: string; change: ChangeDealRoomUnitRequest }) => {
      const payload = changeDealRoomUnitRequestSchema.parse(change);
      return dealSummarySchema.parse(await ApiClient.patch(
        `/v2/deals/${encodeURIComponent(id)}/room-unit`,
        payload,
      ));
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(dealKeys.detail(deal.id), deal);
      queryClient.invalidateQueries({ queryKey: dealKeys.roomHistory(deal.id) });
      return queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useUpdateDealCommercialTermsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, update }: { id: string; update: UpdateDealCommercialTermsRequest }) => {
      const payload = updateDealCommercialTermsRequestSchema.parse(update);
      return dealSummarySchema.parse(await ApiClient.patch(
        `/v2/deals/${encodeURIComponent(id)}/commercial-terms`,
        payload,
      ));
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(dealKeys.detail(deal.id), deal);
      return queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useUpdateDealContractDepositMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, update }: { id: string; update: UpdateDealContractDepositRequest }) => {
      const payload = updateDealContractDepositRequestSchema.parse(update);
      return dealSummarySchema.parse(await ApiClient.patch(
        `/v2/deals/${encodeURIComponent(id)}/contract-deposit`,
        payload,
      ));
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(dealKeys.detail(deal.id), deal);
      return queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useUpdateDealRentalScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, update }: { id: string; update: UpdateDealRentalScheduleRequest }) => {
      const payload = updateDealRentalScheduleRequestSchema.parse(update);
      return dealSummarySchema.parse(await ApiClient.patch(
        `/v2/deals/${encodeURIComponent(id)}/rental-schedule`,
        payload,
      ));
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(dealKeys.detail(deal.id), deal);
      return queryClient.invalidateQueries({ queryKey: dealKeys.all });
    },
  });
}

export function useCreateDealDirectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDealDirectRequest) => {
      const payload = createDealDirectRequestSchema.parse(input);
      return dealSummarySchema.parse(await ApiClient.post('/v2/deals', payload));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dealKeys.all }),
  });
}

export function useCreateDealFromBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDealFromBookingRequest) => {
      const payload = createDealFromBookingRequestSchema.parse(input);
      return dealSummarySchema.parse(await ApiClient.post('/v2/deals/from-booking', payload));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dealKeys.all }),
  });
}
