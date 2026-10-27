import { useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import type { DealSummary } from '@tinyhouse/contracts';
import { toast } from '../../../lib/toast';
import { useUpdateDealContractDepositMutation } from '../api';

function inputAmount(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN;
}

export function DealContractDepositDialog({
  deal,
  onClose,
  onUpdated,
}: {
  deal: DealSummary;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [contractSigned, setContractSigned] = useState(deal.contractSigned);
  const [required, setRequired] = useState(
    deal.depositRequiredAmount === null ? '' : String(deal.depositRequiredAmount),
  );
  const [paid, setPaid] = useState(String(deal.depositPaidAmount));
  const mutation = useUpdateDealContractDepositMutation();

  const requiredAmount = inputAmount(required);
  const paidAmount = inputAmount(paid);
  const fullDeposit = requiredAmount !== null
    && Number.isFinite(requiredAmount)
    && requiredAmount > 0
    && paidAmount !== null
    && Number.isFinite(paidAmount)
    && paidAmount >= requiredAmount;
  const complete = contractSigned && fullDeposit;

  const submit = async () => {
    if (Number.isNaN(requiredAmount) || paidAmount === null || Number.isNaN(paidAmount)) {
      toast.error('Vui lòng nhập số tiền cọc hợp lệ.');
      return;
    }

    try {
      await mutation.mutateAsync({
        id: deal.id,
        update: {
          contractSigned,
          depositRequiredAmount: requiredAmount,
          depositPaidAmount: paidAmount,
        },
      });
      toast.success('Đã cập nhật dữ kiện hợp đồng và tiền cọc.');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật hợp đồng/cọc.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Cập nhật hợp đồng & tiền cọc</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2.25}>
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{deal.id}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Trạng thái ký hợp đồng và tiền cọc được ghi nhận riêng, không lấy từ trạng thái lịch xem.
          </Typography>
        </Box>

        <FormControlLabel
          label="Quản trị viên xác nhận khách đã ký hợp đồng thuê"
          control={<Checkbox
            checked={contractSigned}
            onChange={(_, checked) => setContractSigned(checked)}
            disabled={mutation.isPending}
          />}
        />

        <TextField
          label="Tiền cọc cần đóng"
          type="number"
          value={required}
          onChange={(event) => setRequired(event.target.value)}
          disabled={mutation.isPending}
          slotProps={{ htmlInput: { min: 0, step: 100000 } }}
          helperText="Để trống nếu chưa xác định mức cọc. Hệ thống không tự suy ra số tháng cọc."
        />

        <TextField
          label="Tiền cọc đã ghi nhận"
          type="number"
          value={paid}
          onChange={(event) => setPaid(event.target.value)}
          disabled={mutation.isPending}
          slotProps={{ htmlInput: { min: 0, step: 100000 } }}
          helperText="Số tiền này do quản trị viên xác nhận trên hệ thống; không thay thế chứng từ thanh toán."
        />

        <Box sx={{
          p: 1.5,
          border: 1,
          borderColor: complete ? 'success.main' : 'divider',
          borderRadius: 2,
        }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {complete
              ? 'Đã ký hợp đồng và đóng đủ cọc'
              : 'Chưa đủ điều kiện: ký hợp đồng và đóng đủ cọc'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Khi đủ hai điều kiện, khoản hoa hồng liên quan mới đủ điều kiện để tiếp tục xử lý.
          </Typography>
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button variant="contained" onClick={() => void submit()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Đang lưu…' : 'Lưu dữ kiện'}
      </Button>
    </DialogActions>
  </Dialog>;
}
