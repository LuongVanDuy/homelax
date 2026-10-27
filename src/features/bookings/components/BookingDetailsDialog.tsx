import { CmsBadge as Chip } from '../../../components/cms';
import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';
import { CalendarDays, ContactRound, Home } from 'lucide-react';
import { useNavigate } from 'react-router';
import { bookingAllowedTransitions, bookingCanRescheduleStatus, type BookingSummary, type BookingTransition } from '@tinyhouse/contracts';
import type { AppIdentity } from '../../auth/identityStore';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { toast } from '../../../lib/toast';
import { useBookingQuery, useTransitionBookingMutation } from '../api';
import { BookingAssignmentDialog } from './BookingAssignmentDialog';
import { BookingRescheduleDialog } from './BookingRescheduleDialog';

function valueOrDash(value: string | number | null | undefined) {
  return value === '' || value == null ? '-' : String(value);
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function Info({ label, value, secondary }: {
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 700, overflowWrap: 'anywhere' }}>
      {value}
    </Typography>
    {secondary && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
      {secondary}
    </Typography>}
  </Box>;
}

const TRANSITION_LABELS: Record<BookingTransition, string> = {
  confirm: 'Xác nhận lịch',
  markViewed: 'Đã xem phòng',
  markDeposit: 'Ghi nhận đã cọc',
  close: 'Đánh dấu đã chốt',
  cancel: 'Hủy lịch',
};

function statusTone(status: string) {
  if (status === 'Đã xác nhận') return 'success' as const;
  if (['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(status)) return 'info' as const;
  if (['Đã huỷ', 'Đã hủy'].includes(status)) return 'error' as const;
  return 'warning' as const;
}

function nextStep(booking: BookingSummary) {
  if (booking.dealId) {
    return {
      title: 'Đã chuyển sang giao dịch thuê',
      description: `Giao dịch ${booking.dealId} đang tiếp tục xử lý phần thuê, hợp đồng và tiền cọc.`,
    };
  }
  if (booking.status === 'Chờ xác nhận') {
    return {
      title: 'Xác nhận lịch với khách',
      description: booking.assignedUserId
        ? 'Kiểm tra lại thời gian và xác nhận lịch hẹn với khách.'
        : 'Xác nhận lịch hẹn và phân người phụ trách dẫn khách xem.',
    };
  }
  if (booking.status === 'Đã xác nhận') {
    return {
      title: booking.assignedUserId ? 'Chờ khách đến xem phòng' : 'Phân người phụ trách',
      description: booking.assignedUserId
        ? `Người phụ trách: ${booking.assignedUserName || 'Đã phân công'}.`
        : 'Lịch đã xác nhận nhưng chưa có người phụ trách.',
    };
  }
  if (['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(booking.status)) {
    return {
      title: 'Ghi nhận kết quả sau khi xem',
      description: 'Nếu khách quyết định thuê, chuyển sang Giao dịch thuê để xử lý căn thực tế, hợp đồng và tiền cọc.',
    };
  }
  return {
    title: 'Lịch đã kết thúc',
    description: 'Không còn thao tác tiếp theo cho lịch này.',
  };
}

export function BookingDetailsDialog({
  bookingId,
  currentUser,
  onClose,
}: {
  bookingId: string;
  currentUser: AppIdentity;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const query = useBookingQuery(bookingId);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const transitionMutation = useTransitionBookingMutation();

  const booking = query.data;
  const canManageAssignment = Boolean(
    booking?.assignedUserId ? currentUser?.bookingCanReassign : currentUser?.bookingCanAssign,
  );
  const allowedTransitions = booking ? bookingAllowedTransitions(booking.status) : [];
  const forwardTransitions = allowedTransitions.filter((item) =>
    item === 'confirm' || item === 'markViewed',
  );
  const canCancel = Boolean(
    currentUser?.bookingCanCancel && allowedTransitions.includes('cancel'),
  );
  const canReschedule = Boolean(
    currentUser?.bookingCanReschedule && booking && bookingCanRescheduleStatus(booking.status),
  );
  const canCreateDeal = Boolean(
    booking
    && currentUser?.dealCanCreate
    && booking.customerId
    && !booking.dealId
    && ['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(booking.status),
  );

  const runTransition = async (transition: BookingTransition) => {
    if (!booking) return;
    try {
      await transitionMutation.mutateAsync({
        id: booking.id,
        command: { transition },
      });
      toast.success(`Đã cập nhật: ${TRANSITION_LABELS[transition]}.`);
      setCancelOpen(false);
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật lịch xem.');
    }
  };

  return <>
    <Dialog open fullWidth maxWidth="md" onClose={onClose} aria-labelledby="booking-detail-title">
      <DialogTitle id="booking-detail-title">
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <CalendarDays size={22} />
          <Box>
            <Typography sx={{ fontWeight: 800 }}>Chi tiết lịch xem</Typography>
            <Typography variant="caption" color="text.secondary">{bookingId}</Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {query.isPending ? <LoadingState label="Đang tải lịch xem…" minHeight={280} /> :
          query.isError ? <ErrorState
            title="Không tải được lịch xem"
            description="Vui lòng thử lại."
            action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
          /> : booking ? <BookingDetail booking={booking} /> : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        {booking?.customerId && <Button onClick={() =>
          navigate(`/cms/customers?customer=${encodeURIComponent(booking.customerId!)}`)
        }>
          Xem khách hàng
        </Button>}

        {canManageAssignment && booking && <Button onClick={() => setAssignmentOpen(true)}>Phân công</Button>}
        {canReschedule && booking && <Button onClick={() => setRescheduleOpen(true)}>Đổi lịch</Button>}

        {Boolean(currentUser?.bookingCanTransition) && forwardTransitions.map((transition) => <Button
          key={transition}
          variant="contained"
          disabled={transitionMutation.isPending}
          onClick={() => void runTransition(transition)}
        >
          {TRANSITION_LABELS[transition]}
        </Button>)}

        {canCreateDeal && booking && <Button
          variant="contained"
          color="success"
          onClick={() => navigate(`/cms/deals?createFromBooking=${encodeURIComponent(booking.id)}`)}
        >
          Tạo giao dịch thuê
        </Button>}

        {booking?.dealId && <Button
          variant="contained"
          color="success"
          onClick={() => navigate(`/cms/deals?deal=${encodeURIComponent(booking.dealId!)}`)}
        >
          Xem giao dịch {booking.dealId}
        </Button>}

        {canCancel && <Button
          color="error"
          disabled={transitionMutation.isPending}
          onClick={() => setCancelOpen(true)}
        >
          Hủy lịch
        </Button>}
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>

    {assignmentOpen && booking && <BookingAssignmentDialog
      booking={booking}
      canReassign={Boolean(currentUser?.bookingCanReassign)}
      onClose={() => setAssignmentOpen(false)}
      onSaved={() => void query.refetch()}
    />}
    {rescheduleOpen && booking && <BookingRescheduleDialog
      booking={booking}
      onClose={() => setRescheduleOpen(false)}
      onSaved={() => void query.refetch()}
    />}
    <ConfirmDialog
      open={cancelOpen}
      title="Hủy lịch xem?"
      description="Lịch sẽ được kết thúc và vẫn được giữ trong lịch sử khách hàng."
      confirmLabel="Hủy lịch"
      danger
      loading={transitionMutation.isPending}
      onClose={() => setCancelOpen(false)}
      onConfirm={() => runTransition('cancel')}
    />
  </>;
}

function BookingDetail({ booking }: { booking: BookingSummary }) {
  const source = [booking.sourceType, booking.sourceChannel].filter(Boolean).join(' · ') || 'Chưa ghi nhận';
  const ctv = booking.collaboratorName || (booking.collaboratorId ? 'Có CTV giới thiệu' : 'Không có');
  const assignee = booking.assignedUserName || 'Chưa phân công';
  const step = nextStep(booking);

  return <Stack spacing={3}>
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2.5, border: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
        <Chip label={booking.status} color={statusTone(booking.status)} size="small" />
        <Chip label={booking.buildingCode || 'Chưa có mã tòa'} icon={<Home size={14} />} size="small" variant="outlined" />
        {booking.customerId && <Chip label="Đã có hồ sơ khách" icon={<ContactRound size={14} />} size="small" variant="outlined" />}
      </Stack>
      <Typography sx={{ fontWeight: 800 }}>{step.title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{step.description}</Typography>
    </Box>

    <Box>
      <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Khách hàng</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
        <Info label="Họ tên" value={valueOrDash(booking.customerName)} />
        <Info label="Liên hệ" value={valueOrDash(booking.phone)} secondary={booking.email || undefined} />
      </Box>
    </Box>

    <Divider />

    <Box>
      <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Phòng muốn xem</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
        <Info label="Tòa nhà" value={booking.buildingName || booking.buildingCode || '-'} secondary={booking.buildingCode || undefined} />
        <Info label="Loại phòng" value={booking.roomTypeName || 'Chưa xác định'} />
        <Info label="Căn / phòng" value={booking.roomNumber || 'Chưa chọn căn cụ thể'} />
      </Box>
    </Box>

    <Divider />

    <Box>
      <Typography sx={{ fontWeight: 800, mb: 1.25 }}>Lịch hẹn & xử lý</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
        <Info
          label="Thời gian xem"
          value={[booking.appointmentDate, booking.appointmentTime].filter(Boolean).join(' · ') || 'Chưa xác định'}
        />
        <Info label="Người phụ trách" value={assignee} secondary={booking.assignedUserEmail || undefined} />
        <Info
          label="Nguồn khách"
          value={source}
          secondary={booking.sourceRecordedAt ? `Ghi nhận ${formatDateTime(booking.sourceRecordedAt)}` : undefined}
        />
        <Info label="CTV giới thiệu" value={ctv} />
      </Box>
    </Box>

    <Divider />

    <Box>
      <Typography sx={{ fontWeight: 800, mb: 0.75 }}>Ghi chú</Typography>
      <Typography variant="body2" color={booking.notes ? 'text.primary' : 'text.secondary'}
        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {booking.notes || 'Chưa có ghi chú.'}
      </Typography>
    </Box>
  </Stack>;
}

