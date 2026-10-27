import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import type { DealSummary } from '@tinyhouse/contracts';
import { DatePickerField } from '../../../components/ui/forms/DatePickerField';
import { toast } from '../../../lib/toast';
import { useUpdateDealRentalScheduleMutation } from '../api';

export function DealRentalScheduleDialog({
  deal,
  onClose,
  onUpdated,
}: {
  deal: DealSummary;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [rentalStartDate, setRentalStartDate] = useState(deal.rentalStartDate || '');
  const [rentalEndDate, setRentalEndDate] = useState(deal.rentalEndDate || '');
  const mutation = useUpdateDealRentalScheduleMutation();

  const submit = async () => {
    try {
      await mutation.mutateAsync({
        id: deal.id,
        update: {
          rentalStartDate: rentalStartDate || null,
          rentalEndDate: rentalEndDate || null,
        },
      });
      toast.success('Đã cập nhật lịch thuê.');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật lịch thuê.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Cập nhật lịch thuê</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2.25}>
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{deal.id}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Đây là lịch thuê để theo dõi vận hành. Ngày này không thay thế ngày hiệu lực pháp lý của hợp đồng,
            không tự thay đổi trạng thái căn và không lấy từ lịch xem.
          </Typography>
        </Box>

        <DatePickerField
          label="Ngày bắt đầu thuê"
          value={rentalStartDate}
          maxDate={rentalEndDate || undefined}
          onChange={(value) => {
            setRentalStartDate(value);
            if (!value) setRentalEndDate('');
          }}
          disabled={mutation.isPending}
        />
        <DatePickerField
          label="Ngày kết thúc thuê"
          value={rentalEndDate}
          minDate={rentalStartDate || undefined}
          onChange={setRentalEndDate}
          disabled={mutation.isPending || !rentalStartDate}
        />

        <Typography variant="caption" color="text.secondary">
          Có thể chỉ ghi ngày bắt đầu khi ngày kết thúc chưa xác định. Hệ thống không tự suy kỳ hạn 6/12 tháng.
        </Typography>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button variant="contained" onClick={() => void submit()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Đang lưu…' : 'Lưu lịch thuê'}
      </Button>
    </DialogActions>
  </Dialog>;
}