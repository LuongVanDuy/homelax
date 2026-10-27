import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { DealSummary } from '@tinyhouse/contracts';
import { toast } from '../../../lib/toast';
import { useCancelDealMutation } from '../api';

export function DealCancelDialog({
  deal,
  onClose,
  onUpdated,
}: {
  deal: DealSummary;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [reason, setReason] = useState('');
  const mutation = useCancelDealMutation();

  const submit = async () => {
    try {
      await mutation.mutateAsync({
        id: deal.id,
        cancel: { reason: reason.trim() || null },
      });
      toast.success('Đã hủy giao dịch và giữ nguyên lịch sử.');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể hủy giao dịch.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Hủy giao dịch</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{deal.id}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Giao dịch sẽ chuyển sang trạng thái đã hủy và vẫn giữ toàn bộ lịch sử liên quan. Căn hiện tại sẽ được trả về trạng thái trống, trừ khi đang bảo trì hoặc đã lưu trữ.
          </Typography>
        </Box>
        <TextField
          label="Lý do hủy (không bắt buộc)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={3}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          disabled={mutation.isPending}
        />
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Đóng</Button>
      <Button color="error" variant="contained" onClick={() => void submit()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Đang hủy…' : 'Xác nhận hủy giao dịch'}
      </Button>
    </DialogActions>
  </Dialog>;
}