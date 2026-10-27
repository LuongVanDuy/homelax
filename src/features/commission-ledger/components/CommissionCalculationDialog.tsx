import { useState } from 'react';
import type { CommissionHistoryItem } from '@tinyhouse/contracts';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { toast } from '../../../lib/toast';
import { useCommissionAllocationStatusQuery } from '../../commission-config/api';
import { useCalculateCommissionMutation } from '../api';

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function CommissionCalculationDialog({
  item,
  onClose,
  onCalculated,
}: {
  item: CommissionHistoryItem;
  onClose: () => void;
  onCalculated: () => void;
}) {
  const [grossCommissionX, setGrossCommissionX] = useState(
    item.grossCommissionX === null ? '' : String(item.grossCommissionX),
  );
  const [ctvBonus, setCtvBonus] = useState(
    item.ctvBonusAmount === null ? '0' : String(item.ctvBonusAmount),
  );
  const statusQuery = useCommissionAllocationStatusQuery();
  const mutation = useCalculateCommissionMutation();

  const gross = Number(grossCommissionX);
  const bonus = Number(ctvBonus || 0);
  const estimatedTax = Number.isFinite(gross) ? gross * 0.1 : 0;
  const estimatedPool = Number.isFinite(gross) ? gross * 0.9 : 0;
  const ctvRate = item.ctvPercentageSnapshot ?? null;

  const submit = async () => {
    if (!grossCommissionX.trim() || !Number.isFinite(gross) || gross < 0) {
      toast.error('Vui lòng nhập số tiền X hợp lệ.');
      return;
    }
    if (!Number.isFinite(bonus) || bonus < 0) {
      toast.error('Tiền thưởng CTV phải là số không âm.');
      return;
    }
    if (!statusQuery.data?.readyForCalculation) {
      toast.error('Cơ cấu phân bổ chưa đủ 100% hoặc chưa có đúng một vị trí CTV.');
      return;
    }
    try {
      await mutation.mutateAsync({
        ledgerId: item.id,
        value: { grossCommissionX: gross, ctvBonus: bonus },
      });
      toast.success('Đã tính hoa hồng.');
      onCalculated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tính hoa hồng.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Tính hoa hồng</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Alert severity={statusQuery.data?.readyForCalculation ? 'success' : 'warning'}>
          Cơ cấu hiện tại: {statusQuery.data?.activePercentageTotal ?? 0}% ·
          CTV: {statusQuery.data?.ctvTargetName || 'chưa chọn'}.
        </Alert>

        <TextField
          label="Tổng hoa hồng (X)"
          type="number"
          value={grossCommissionX}
          onChange={(event) => setGrossCommissionX(event.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 1000 } }}
          helperText="Khoản hoa hồng gốc do quản trị viên nhập, không lấy từ giá thuê tháng."
          autoFocus
        />
        <TextField
          label="Thưởng CTV (nếu có)"
          type="number"
          value={ctvBonus}
          onChange={(event) => setCtvBonus(event.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 1000 } }}
          helperText="Cộng nguyên sau hoa hồng cơ bản, không khấu trừ 10%."
        />

        <Box sx={{ p: 1.75, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="body2"><strong>Tổng hoa hồng (X):</strong> {money(Number.isFinite(gross) ? gross : 0)}</Typography>
          <Typography variant="body2"><strong>Khấu trừ 10%:</strong> {money(estimatedTax)}</Typography>
          <Typography variant="body2"><strong>Quỹ phân bổ còn lại:</strong> {money(estimatedPool)}</Typography>
          {ctvRate !== null && <Typography variant="body2">
            <strong>Tỷ lệ CTV lần tính trước:</strong> {ctvRate}%
          </Typography>}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Hệ thống sẽ ghi lại cơ cấu phân bổ của lần tính này để các thay đổi sau không ảnh hưởng khoản đã tính.
          </Typography>
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button variant="contained" onClick={() => void submit()} disabled={mutation.isPending || !statusQuery.data?.readyForCalculation}>
        {mutation.isPending ? 'Đang tính…' : 'Tính hoa hồng'}
      </Button>
    </DialogActions>
  </Dialog>;
}
