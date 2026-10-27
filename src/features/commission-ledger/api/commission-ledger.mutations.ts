import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  commissionCalculationRequestSchema,
  commissionExceptionResolutionRequestSchema,
  commissionLedgerNullableSchema,
  type CommissionCalculationRequest,
  type CommissionExceptionResolutionRequest,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { commissionLedgerKeys } from './commission-ledger.queries';

function invalidateCommissionLedger(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: commissionLedgerKeys.all });
}

export function useReconcileCommissionLedgerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => commissionLedgerNullableSchema.parse(
      await ApiClient.post(`/v2/commission-ledger/deals/${encodeURIComponent(dealId)}/reconcile`, {}),
    ),
    onSuccess: () => invalidateCommissionLedger(queryClient),
  });
}

export function useCalculateCommissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ledgerId, value }: { ledgerId: string; value: CommissionCalculationRequest }) => {
      const payload = commissionCalculationRequestSchema.parse(value);
      return commissionLedgerNullableSchema.parse(await ApiClient.patch(
        `/v2/commission-ledger/entries/${encodeURIComponent(ledgerId)}/calculation`,
        payload,
      ));
    },
    onSuccess: () => invalidateCommissionLedger(queryClient),
  });
}

export function useResolveCommissionExceptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ledgerId,
      value,
    }: {
      ledgerId: string;
      value: CommissionExceptionResolutionRequest;
    }) => {
      const payload = commissionExceptionResolutionRequestSchema.parse(value);
      return commissionLedgerNullableSchema.parse(await ApiClient.patch(
        `/v2/commission-ledger/entries/${encodeURIComponent(ledgerId)}/exception-resolution`,
        payload,
      ));
    },
    onSuccess: () => invalidateCommissionLedger(queryClient),
  });
}

export function useApproveCommissionAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ledgerId: string) => commissionLedgerNullableSchema.parse(
      await ApiClient.post(
        `/v2/commission-ledger/entries/${encodeURIComponent(ledgerId)}/admin-approval`,
        {},
      ),
    ),
    onSuccess: () => invalidateCommissionLedger(queryClient),
  });
}

export function useApproveCommissionAccountantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ledgerId: string) => commissionLedgerNullableSchema.parse(
      await ApiClient.post(
        `/v2/commission-ledger/entries/${encodeURIComponent(ledgerId)}/accountant-approval`,
        {},
      ),
    ),
    onSuccess: () => invalidateCommissionLedger(queryClient),
  });
}

export function useRequestCommissionWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ledgerId: string) => commissionLedgerNullableSchema.parse(
      await ApiClient.post(
        `/v2/commission-ledger/entries/${encodeURIComponent(ledgerId)}/withdrawal-request`,
        {},
      ),
    ),
    onSuccess: () => invalidateCommissionLedger(queryClient),
  });
}

export function useMarkCommissionPaidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ledgerId: string) => commissionLedgerNullableSchema.parse(
      await ApiClient.post(
        `/v2/commission-ledger/entries/${encodeURIComponent(ledgerId)}/mark-paid`,
        {},
      ),
    ),
    onSuccess: () => invalidateCommissionLedger(queryClient),
  });
}
