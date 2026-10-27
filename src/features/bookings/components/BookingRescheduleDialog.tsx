import { useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { BOOKING_MIN_LEAD_MINUTES, bookingMeetsMinimumLeadTime, normalizeBookingTime24h, type BookingSummary } from '@tinyhouse/contracts';
import { DatePickerField } from '../../../components/ui/forms/DatePickerField';
import { toast } from '../../../lib/toast';
import { useRescheduleBookingMutation } from '../api';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function BookingRescheduleDialog({
  booking,
  onClose,
  onSaved,
}: {
  booking: BookingSummary;
  onClose: () => void;
  onSaved: (booking: BookingSummary) => void;
}) {
  const initialTime = normalizeBookingTime24h(booking.appointmentTime) || '';
  const [appointmentDate, setAppointmentDate] = useState(booking.appointmentDate || '');
  const [appointmentTime, setAppointmentTime] = useState(initialTime);
  const timezoneOffset = useMemo(
    () => booking.appointmentTimezoneOffsetMinutes ?? new Date().getTimezoneOffset(),
    [booking.appointmentTimezoneOffsetMinutes],
  );
  const mutation = useRescheduleBookingMutation();
  const [validationMessage, setValidationMessage] = useState('');

  const submit = async () => {
    if (!appointmentDate || !appointmentTime) {
      setValidationMessage('Vui lòng chọn đủ ngày và giờ hẹn mới.');
      return;
    }

    if (!bookingMeetsMinimumLeadTime(
      appointmentDate,
      appointmentTime,
      timezoneOffset,
    )) {
      setValidationMessage(
        `Lịch mới phải cách thời điểm hiện tại ít nhất ${BOOKING_MIN_LEAD_MINUTES} phút.`,
      );
      return;
    }

    setValidationMessage('');
    try {
      const saved = await mutation.mutateAsync({
        id: booking.id,
        schedule: {
          appointmentDate,
          appointmentTime,
          appointmentTimezoneOffsetMinutes: timezoneOffset,
        },
      });
      toast.success('Đã đổi lịch xem. Trạng thái đã quay về “Chờ xác nhận”.');
      onSaved(saved);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi lịch xem.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Đổi lịch xem</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {booking.customerName || booking.id}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {booking.id} · {booking.buildingName || booking.buildingCode || 'Chưa có tòa'}
          </Typography>
        </Box>

        <DatePickerField
          label="Ngày hẹn mới"
          value={appointmentDate}
          minDate={localDateValue()}
          disabled={mutation.isPending}
          onChange={(value) => {
            setAppointmentDate(value);
            setValidationMessage('');
          }}
        />

        <TextField
          label="Giờ hẹn mới"
          type="time"
          value={appointmentTime}
          disabled={mutation.isPending}
          onChange={(event) => {
            setAppointmentTime(event.target.value);
            setValidationMessage('');
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { step: 300 },
          }}
          sx={{ '& .MuiInputBase-root': { height: 44 } }}
        />

        {validationMessage && <Typography variant="body2" color="error.main">
          {validationMessage}
        </Typography>}

        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Sau khi đổi lịch
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Trạng thái sẽ về “Chờ xác nhận” để Quản trị khách hàng xác nhận lại với khách.
            Thời gian mới phải cách hiện tại ít nhất {BOOKING_MIN_LEAD_MINUTES} phút.
          </Typography>
        </Box>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button
        variant="contained"
        onClick={() => void submit()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Đang lưu…' : 'Lưu lịch mới'}
      </Button>
    </DialogActions>
  </Dialog>;
}
