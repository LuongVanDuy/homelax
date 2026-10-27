import { useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { BOOKING_STATUSES, type BookingStatus } from '@tinyhouse/contracts';
import { useOutletContext } from 'react-router';
import { Building2, CalendarDays, Clock3, ChevronRight } from 'lucide-react';
import type { AppIdentity } from '../../auth/identityStore';
import { useSelfBookingQuery, useSelfBookingsPageQuery } from '../../bookings/api/booking.queries';
import { accountCardSx } from '../accountSurface';

const date = (value: string | null) => value ? value.slice(0, 10).split('-').reverse().join('/') : 'Chưa cập nhật';
const statusColor = (status: string) => {
  if (status === 'Đã xác nhận') return 'success' as const;
  if (['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(status)) return 'info' as const;
  if (['Đã huỷ', 'Đã hủy'].includes(status)) return 'error' as const;
  return 'warning' as const;
};

function BookingDetail({ id, userId, close }: { id: string; userId: string; close: () => void }) {
  const query = useSelfBookingQuery(userId, id);
  const item = query.data;
  return <Dialog open onClose={close} maxWidth="sm" fullWidth>
    <DialogTitle>Chi tiết lịch xem phòng</DialogTitle>
    <DialogContent>
      {query.isError ? <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}>Lịch không còn khả dụng hoặc chưa tải được.</Alert>
        : !item ? <Skeleton height={220} variant="rounded" /> : <Stack spacing={2} sx={{ pt: 1 }}>
          <Chip label={item.status} color={statusColor(item.status)} sx={{ alignSelf: 'flex-start' }} />
          <Typography sx={{ fontWeight: 700 }}>{item.buildingName || `Tòa ${item.buildingCode}`}</Typography>
          <Typography>{item.roomTypeName || 'Loại phòng đang cập nhật'} · Căn {item.roomNumber || 'Chưa cập nhật'}</Typography>
          <Typography>Ngày hẹn: <strong>{date(item.appointmentDate)}</strong> · Giờ hẹn: <strong>{item.appointmentTime || 'Chưa cập nhật'}</strong></Typography>
          <Typography>Người đặt: {item.customerName}</Typography>
          <Typography>Số điện thoại: {item.phone}</Typography>
          <Typography color="text.secondary" variant="body2">Mã lịch: {item.id}</Typography>
        </Stack>}
    </DialogContent>
    <DialogActions><Button onClick={close}>Đóng</Button></DialogActions>
  </Dialog>;
}

export function PublicBookingsPage() {
  const { currentUser } = useOutletContext<{ currentUser: AppIdentity }>();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [detailId, setDetailId] = useState('');
  const query = useSelfBookingsPageQuery(currentUser?.id || '', { page, pageSize: 12, status, sort: 'createdAt', order: 'desc' });
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
      <Typography component="h2" variant="h6" sx={{ fontWeight: 800, flex: 1 }}>Lịch xem phòng{query.data ? ` (${query.data.pagination.total})` : ''}</Typography>
      <TextField select fullWidth={false} label="Trạng thái" value={status} sx={{ width: { xs: '100%', sm: 240 }, flexShrink: 0 }}
        slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
        onChange={event => { setStatus(event.target.value as BookingStatus | ''); setPage(1); }}>
        <MenuItem value="">Tất cả trạng thái</MenuItem>
        {BOOKING_STATUSES.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
    </Stack>
    {query.isError ? <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}>Không tải được lịch xem phòng.</Alert>
      : !query.data ? <Skeleton variant="rounded" height={220} /> : <>
        {!query.data.items.length && <Alert severity="info">{status ? 'Không có lịch xem ở trạng thái này.' : 'Bạn chưa có lịch xem được liên kết với tài khoản.'}</Alert>}
        {query.data.items.map(item => <Paper key={item.id} variant="outlined" sx={{ ...accountCardSx, p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ display: 'grid', gap: { xs: 2, lg: 3 }, alignItems: 'center',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 180px', lg: 'minmax(0,1fr) 185px 250px' } }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: .75, mb: .5, color: 'text.secondary' }}>
                <Building2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.buildingName || `Tòa ${item.buildingCode}`}</Typography>
              </Stack>
              <Typography component="h3" sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{item.roomTypeName || 'Loại phòng đang cập nhật'} · Căn {item.roomNumber || 'Chưa cập nhật'}</Typography>
            </Box>
            <Stack direction={{ xs: 'row', md: 'column' }} sx={{ gap: { xs: 2, md: .75 }, flexWrap: 'wrap', color: 'text.secondary' }}>
              <Stack direction="row" sx={{ gap: .75, alignItems: 'center' }}><CalendarDays size={17} aria-hidden="true" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{date(item.appointmentDate)}</Typography></Stack>
              <Stack direction="row" sx={{ gap: .75, alignItems: 'center' }}><Clock3 size={17} aria-hidden="true" />
                <Typography variant="body2">{item.appointmentTime || 'Chưa cập nhật giờ'}</Typography></Stack>
            </Stack>
            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between',
              gridColumn: { md: '1 / -1', lg: 'auto' }, borderTop: { xs: `1px solid ${accountCardSx.borderColor}`, lg: 0 }, pt: { xs: 1.5, lg: 0 } }}>
              <Chip size="small" label={item.status} color={statusColor(item.status)} sx={{ height: 28, fontSize: 12 }} />
              <Button variant="outlined" endIcon={<ChevronRight size={16} />} aria-label={`Chi tiết lịch xem ${item.roomTypeName} căn ${item.roomNumber}`}
                onClick={() => setDetailId(item.id)} sx={{ flexShrink: 0 }}>Chi tiết</Button>
            </Stack>
          </Box>
        </Paper>)}
        {Math.max(page, query.data.pagination.totalPages) > 1 && <Pagination page={page} count={Math.max(page, query.data.pagination.totalPages)} onChange={(_, next) => setPage(next)} aria-label="Trang lịch xem" />}
      </>}
    {detailId && <BookingDetail id={detailId} userId={currentUser?.id || ''} close={() => setDetailId('')} />}
  </Stack>;
}
