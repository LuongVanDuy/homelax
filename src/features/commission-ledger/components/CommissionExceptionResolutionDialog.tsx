import { useState } from 'react';
import type { CommissionHistoryItem } from '@tinyhouse/contracts';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { toast } from '../../../lib/toast';
import { useCommissionAllocationStatusQuery } from '../../commission-config/api';
import { useResolveCommissionExceptionMutation } from '../api';

function money(value: number | null) {
  if (value === null) return 'Chưa xác định';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function reviewLabel(reviewReason: string) {
  const labels: string[] = [];
  if (reviewReason.includes('deal_cancelled')) labels.push('Giao dịch đã hủy');
  if (reviewReason.includes('contract_deposit_completion_reversed')) {
    labels.push('Điều kiện ký hợp đồng / đủ cọc đã bị đảo');
  }
  if (reviewReason.includes('room_unit_changed_after_eligibility')) labels.push('Đã đổi căn sau khi ghi nhận');
  return labels.length ? labels.join(' · ') : reviewReason || 'Case cần rà soát';
}

export function CommissionExceptionResolutionDialog({
  item,
  onClose,
  onResolved,
}: {
  item: CommissionHistoryItem;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [grossCommissionX, setGrossCommissionX] = useState('');
  const [ctvBonus, setCtvBonus] = useState(String(item.ctvBonusAmount ?? 0));
  const [reason, setReason] = useState('');
  const mutation = useResolveCommissionExceptionMutation();
  const allocationStatusQuery = useCommissionAllocationStatusQuery();

  const hasPreviousSnapshot = item.allocationSnapshot.length > 0;
  const allocationReady = hasPreviousSnapshot || Boolean(allocationStatusQuery.data?.readyForCalculation);
  const gross = Number(grossCommissionX);
  const bonus = Number(ctvBonus || 0);
  const tax = Number.isFinite(gross) ? gross * 0.1 : 0;
  const pool = Number.isFinite(gross) ? gross * 0.9 : 0;
  const ctvRate = item.ctvPercentageSnapshot;
  const ctvBase = ctvRate !== null ? pool * ctvRate / 100 : null;
  const ctvTotal = ctvBase === null ? null : ctvBase + (Number.isFinite(bonus) ? bonus : 0);

  const submit = async () => {
    if (!grossCommissionX.trim() || !Number.isFinite(gross) || gross < 0) {
      toast.error('Vui lòng nhập X thực thu/được giữ lại hợp lệ.');
      return;
    }
    if (!Number.isFinite(bonus) || bonus < 0) {
      toast.error('Thưởng CTV phải là số không âm.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do xử lý case.');
      return;
    }
    if (!allocationReady) {
      toast.error('Chưa có cơ cấu phân bổ hợp lệ để tính lại case này.');
      return;
    }

    try {
      await mutation.mutateAsync({
        ledgerId: item.id,
        value: {
          grossCommissionX: gross,
          ctvBonus: bonus,
          reason: reason.trim(),
        },
      });
      toast.success('Đã xử lý case và tính lại hoa hồng.');
      onResolved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý case.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Xử lý hủy hợp đồng / bỏ cọc</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Alert severity="warning">
          {reviewLabel(item.reviewReason)}. Vui lòng xác nhận số tiền thực thu hoặc được giữ lại trước khi tính lại hoa hồng.
        </Alert>

        <Box sx={{ p: 1.75, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">Phép tính trước xử lý</Typography>
          <Typography variant="body2"><strong>Số tiền trước xử lý:</strong> {money(item.grossCommissionX)}</Typography>
          <Typography variant="body2"><strong>Hoa hồng CTV cũ:</strong> {money(item.commissionAmount)}</Typography>
          <Typography variant="body2"><strong>Thưởng CTV cũ:</strong> {money(item.ctvBonusAmount)}</Typography>
        </Box>

        <Alert severity={allocationReady ? 'info' : 'error'}>
          {hasPreviousSnapshot
            ? 'Khoản này sẽ giữ nguyên tỷ lệ phân bổ của lần tính trước, nên thay đổi cấu hình hiện tại không làm đổi tỷ lệ đã ghi nhận.'
            : `Khoản này chưa có tỷ lệ phân bổ trước đó; hệ thống sẽ dùng cơ cấu đang hoạt động (${allocationStatusQuery.data?.activePercentageTotal ?? 0}%).`}
        </Alert>

        <TextField
          label="Số tiền thực thu / được giữ lại"
          type="number"
          value={grossCommissionX}
          onChange={(event) => setGrossCommissionX(event.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 1000 } }}
          helperText="Nhập theo kết quả xử lý thực tế. Có thể bằng 0 nếu không giữ lại khoản nào."
          autoFocus
        />

        <TextField
          label="Thưởng CTV sau xử lý"
          type="number"
          value={ctvBonus}
          onChange={(event) => setCtvBonus(event.target.value)}
          slotProps={{ htmlInput: { min: 0, step: 1000 } }}
          helperText="Cộng nguyên sau hoa hồng cơ bản của CTV, không chịu khấu trừ 10%."
        />

        <TextField
          label="Lý do xử lý"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={3}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
          placeholder="Ví dụ: Khách bỏ cọc, chủ nhà giữ lại 500.000đ theo thỏa thuận..."
        />

        <Box sx={{ p: 1.75, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">Tạm tính sau xử lý</Typography>
          <Typography variant="body2"><strong>X mới:</strong> {money(Number.isFinite(gross) ? gross : 0)}</Typography>
          <Typography variant="body2"><strong>Khấu trừ 10%:</strong> {money(tax)}</Typography>
          <Typography variant="body2"><strong>Quỹ 90% X:</strong> {money(pool)}</Typography>
          {ctvRate !== null && <Typography variant="body2">
            <strong>CTV base ({ctvRate}% quỹ):</strong> {money(ctvBase)}
          </Typography>}
          {ctvTotal !== null && <Typography variant="body2">
            <strong>CTV nhận sau xử lý:</strong> {money(ctvTotal)}
          </Typography>}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Hệ thống lưu lịch sử trước/sau, lý do, người xử lý và nguồn tỷ lệ. Không xóa phép tính cũ khỏi lịch sử.
          </Typography>
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button
        variant="contained"
        color="warning"
        onClick={() => void submit()}
        disabled={mutation.isPending || !allocationReady}
      >
        {mutation.isPending ? 'Đang xử lý…' : 'Xác nhận xử lý case'}
      </Button>
    </DialogActions>
  </Dialog>;
}
