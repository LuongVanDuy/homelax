import { useState } from 'react';
import type { DealSummary } from '@tinyhouse/contracts';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { toast } from '../../../lib/toast';
import { useUpdateDealCommercialTermsMutation } from '../api';

export function DealCommercialTermsDialog({
  deal,
  onClose,
  onUpdated,
}: {
  deal: DealSummary;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [finalPrice, setFinalPrice] = useState(String(deal.finalPrice));
  const [contractMonths, setContractMonths] = useState(
    deal.contractMonths === null ? '' : String(deal.contractMonths),
  );
  const mutation = useUpdateDealCommercialTermsMutation();

  const submit = async () => {
    const priceText = finalPrice.trim();
    const price = Number(priceText);
    const monthsText = contractMonths.trim();
    const months = monthsText ? Number(monthsText) : null;

    if (!priceText || !Number.isFinite(price) || price < 0) {
      toast.error('Vui lòng nhập giá thuê / tháng hợp lệ.');
      return;
    }
    if (months !== null && (!Number.isInteger(months) || months <= 0)) {
      toast.error('Số tháng hợp đồng phải là số nguyên lớn hơn 0 hoặc để trống.');
      return;
    }

    try {
      await mutation.mutateAsync({
        id: deal.id,
        update: {
          finalPrice: price,
          contractMonths: months,
        },
      });
      toast.success('Đã cập nhật giá thuê và thời hạn hợp đồng.');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật điều khoản thuê.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Điều khoản thuê</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <TextField
          label="Giá thuê / tháng"
          type="number"
          value={finalPrice}
          onChange={(event) => setFinalPrice(event.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 100000 } }}
          helperText="Đây là giá thuê của một tháng, không phải tổng giá trị hợp đồng."
        />
        <TextField
          label="Số tháng hợp đồng (tùy chọn)"
          type="number"
          value={contractMonths}
          onChange={(event) => setContractMonths(event.target.value)}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          helperText="Có thể để trống. Hệ thống không suy số tháng từ lịch thuê."
        />
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button variant="contained" onClick={() => void submit()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Đang lưu…' : 'Lưu điều khoản'}
      </Button>
    </DialogActions>
  </Dialog>;
}
