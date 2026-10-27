import { Eye, CalendarDays, Filter, Plus, Search } from 'lucide-react';
import { CmsRowActions, CmsActionsCell, CmsFilterField, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Autocomplete, Box, Button, Divider, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';

import { useSearchParams } from 'react-router';
import type { BookingStatus, BookingSummary } from '@tinyhouse/contracts';
import type { AppIdentity } from '../../auth/identityStore';
import { DatePickerField } from '../../../components/ui/forms/DatePickerField';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { updateAutocompleteSearch, useStableAutocompleteOptions } from '../../../hooks/useStableAutocompleteOptions';
import { useBuildingsPageQuery } from '../../buildings/api';
import { useBookingAssigneesQuery, useBookingsPageQuery, useBookingStatsQuery } from '../api';
import { BookingCreateDialog } from '../components/BookingCreateDialog';
import { BookingDetailsDialog } from '../components/BookingDetailsDialog';

type BookingWorkflow = 'pending' | 'upcoming' | 'viewed' | 'cancelled' | 'all';

const WORKFLOW_STATUS: Record<BookingWorkflow, BookingStatus | ''> = {
  pending: 'Chờ xác nhận',
  upcoming: 'Đã xác nhận',
  viewed: 'Đã xem phòng',
  cancelled: 'Đã huỷ',
  all: '',
};

function statusColor(status: string) {
  if (status === 'Đã xác nhận') return 'success' as const;
  if (['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(status)) return 'info' as const;
  if (['Đã huỷ', 'Đã hủy'].includes(status)) return 'error' as const;
  return 'warning' as const;
}

function appointmentLabel(booking: BookingSummary) {
  return [booking.appointmentDate, booking.appointmentTime].filter(Boolean).join(' · ') || 'Chưa có thời gian';
}

function nextAction(booking: BookingSummary) {
  if (booking.dealId) return `Đã chuyển sang ${booking.dealId}`;
  if (booking.status === 'Chờ xác nhận') return 'Xác nhận lịch với khách';
  if (booking.status === 'Đã xác nhận') {
    return booking.assignedUserId ? 'Chờ khách đến xem' : 'Phân người phụ trách';
  }
  if (['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(booking.status)) {
    return 'Ghi kết quả / tạo giao dịch nếu khách thuê';
  }
  return 'Lịch đã kết thúc';
}

export function BookingsPage({ currentUser }: { currentUser: AppIdentity }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [workflow, setWorkflow] = useState<BookingWorkflow>('pending');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [building, setBuilding] = useState('');
  const [buildingSearch, setBuildingSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sort, setSort] = useState('appointment-asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('booking'));
  const [createOpen, setCreateOpen] = useState(Boolean(searchParams.get('createForCustomer')));
  const createForCustomer = searchParams.get('createForCustomer') || undefined;
  const debouncedSearch = useDebouncedValue(search, 350);
  const debouncedBuildingSearch = useDebouncedValue(buildingSearch, 300);
  const canFilterAssignee = currentUser?.bookingScope === 'all';
  const canCreateBooking = currentUser?.bookingScope === 'all';

  const sortParams = sort === 'appointment-desc'
    ? { sort: 'appointmentDate' as const, order: 'desc' as const }
    : sort === 'created-desc'
      ? { sort: 'createdAt' as const, order: 'desc' as const }
      : { sort: 'appointmentDate' as const, order: 'asc' as const };

  const query = useBookingsPageQuery({
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    status: WORKFLOW_STATUS[workflow],
    customerId: '',
    building,
    dateFrom,
    dateTo,
    assignee: canFilterAssignee ? assignee : '',
    ...sortParams,
  });
  const stats = useBookingStatsQuery();
  const assigneesQuery = useBookingAssigneesQuery('', canFilterAssignee && advancedOpen);
  const buildingsQuery = useBuildingsPageQuery({
    scope: 'cms',
    page: 1,
    pageSize: 200,
    search: debouncedBuildingSearch,
    status: '',
    sort: 'name',
    order: 'asc',
  });

  const bookings = query.data?.items || [];
  const total = query.data?.pagination.total || 0;
  const buildingAutocomplete = useStableAutocompleteOptions(
    buildingsQuery.data?.items || [],
    building ? [building] : [],
    (item) => item.id,
  );
  const buildingOptions = buildingAutocomplete.options;

  const openBooking = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('booking', id);
    setSearchParams(next, { replace: true });
  };

  const closeBooking = () => {
    setSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('booking');
    setSearchParams(next, { replace: true });
  };

  const closeCreate = () => {
    setCreateOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete('createForCustomer');
    setSearchParams(next, { replace: true });
  };

  const clearAdvanced = () => {
    setBuilding('');
    setBuildingSearch('');
    setDateFrom('');
    setDateTo('');
    setAssignee('');
    setSort('appointment-asc');
    setPage(0);
  };

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Lịch xem phòng </>} description={<> Xác nhận lịch, phân người dẫn, ghi nhận khách đã xem và chuyển sang giao dịch khi khách muốn thuê. </>} actions={<><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip label={`Tổng: ${stats.data?.total ?? total}`} variant="outlined" />
        <Chip label={`Cần xác nhận: ${stats.data?.pending ?? 0}`} color="warning" variant="outlined" />
        {canCreateBooking && <Button
          variant="contained"
          startIcon={<Plus size={17} />}
          onClick={() => setCreateOpen(true)}
        >
          Tạo lịch xem
        </Button>}
      </Stack></>} />

    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>{(query.isFetching || stats.isFetching) && <LinearProgress sx={{ height: 3 }} />}</Box>

      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <CmsFilterBar inset>
          <CmsFilterField
            fullWidth
            label="Tìm lịch xem"
            placeholder="Mã lịch, tên khách, SĐT, tòa, phòng…"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>,
              },
            }}
          />
          <CmsFilterField select label="Nhóm lịch" value={workflow}
            onChange={(event) => { setWorkflow(event.target.value as BookingWorkflow); setPage(0); }}>
            <MenuItem value="pending">Cần xử lý</MenuItem>
            <MenuItem value="upcoming">Sắp xem</MenuItem>
            <MenuItem value="viewed">Đã xem</MenuItem>
            <MenuItem value="cancelled">Đã hủy</MenuItem>
            <MenuItem value="all">Tất cả</MenuItem>
          </CmsFilterField>
          <Button
            variant={advancedOpen ? 'contained' : 'outlined'}
            startIcon={<Filter size={17} />}
            onClick={() => setAdvancedOpen((value) => !value)}
            sx={{ minWidth: 140 }}
          >
            Lọc thêm
          </Button>
        </CmsFilterBar>

        {advancedOpen && <Box sx={{
          display: 'grid',
          gap: 1.5,
          mt: 1.5,
          gridTemplateColumns: { xs: '1fr', md: canFilterAssignee ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' },
        }}>
          <Autocomplete
            options={buildingOptions}
            value={buildingOptions.find((item) => item.id === building || item.code === building) || null}
            onChange={(_, item) => {
              buildingAutocomplete.rememberOption(item);
              setBuilding(item?.id || '');
              setPage(0);
            }}
            onInputChange={(_, value, reason) => updateAutocompleteSearch(setBuildingSearch, value, reason)}
            loading={buildingsQuery.isFetching}
            getOptionLabel={(item) => `${item.code} · ${item.name}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Tòa nhà" />}
          />
          <DatePickerField label="Từ ngày" value={dateFrom} maxDate={dateTo || undefined}
            onChange={(value) => { setDateFrom(value); setPage(0); }} />
          <DatePickerField label="Đến ngày" value={dateTo} minDate={dateFrom || undefined}
            onChange={(value) => { setDateTo(value); setPage(0); }} />
          {canFilterAssignee && <TextField select label="Người phụ trách" value={assignee}
            onChange={(event) => { setAssignee(event.target.value); setPage(0); }}>
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="unassigned">Chưa phân công</MenuItem>
            <MenuItem value="me">Tôi phụ trách</MenuItem>
            {(assigneesQuery.data || []).map((user) => <MenuItem key={user.id} value={user.id}>
              {user.name || user.email}
            </MenuItem>)}
          </TextField>}
          <TextField select label="Sắp xếp" value={sort}
            onChange={(event) => { setSort(event.target.value); setPage(0); }}>
            <MenuItem value="appointment-asc">Lịch gần nhất</MenuItem>
            <MenuItem value="appointment-desc">Lịch xa nhất</MenuItem>
            <MenuItem value="created-desc">Mới gửi gần nhất</MenuItem>
          </TextField>
          <Button onClick={clearAdvanced}>Xóa lọc thêm</Button>
        </Box>}
      </Box>

      <Divider />

      {query.isError && <ErrorState
        title="Không tải được lịch xem"
        description="Vui lòng kiểm tra kết nối và thử lại."
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
      />}

      {query.isPending ? <LoadingState label="Đang tải lịch xem…" minHeight={320} /> :
        !bookings.length ? <EmptyState
          icon={<CalendarDays size={36} />}
          title="Không có lịch trong nhóm này"
          description={workflow === 'pending'
            ? 'Các lịch khách mới gửi và đang chờ xác nhận sẽ xuất hiện tại đây.'
            : 'Thử nhóm khác hoặc thay đổi bộ lọc.'}
        /> : <>
          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table aria-label="Danh sách lịch xem phòng">
              <TableHead><TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Khách hàng</TableCell>
                <TableCell>Phòng muốn xem</TableCell>
                <TableCell>Phụ trách</TableCell>
                <TableCell>Trạng thái / việc tiếp theo</TableCell>
              <CmsActionsCell>Thao tác</CmsActionsCell></TableRow></TableHead>
              <TableBody>{bookings.map((booking) => <TableRow
                key={booking.id}
                hover
                tabIndex={0}
                role="button"
                onClick={() => openBooking(booking.id)}
                onKeyDown={(event) => {
                  if (!['Enter', ' '].includes(event.key)) return;
                  event.preventDefault();
                  openBooking(booking.id);
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Typography variant="body2" title={booking.id} sx={{ fontWeight: 800 }}>{appointmentLabel(booking)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{booking.customerName || 'Khách'}</Typography>
                  <Typography variant="caption" color="text.secondary">{booking.phone || booking.email || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{booking.buildingCode || booking.buildingName || '-'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[booking.roomTypeName, booking.roomNumber].filter(Boolean).join(' · ') || 'Chưa chọn phòng'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{booking.assignedUserName || 'Chưa phân công'}</Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  <Chip size="small" label={booking.status} color={statusColor(booking.status)} variant="outlined" />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
                    {nextAction(booking)}
                  </Typography>
                </TableCell>
              <CmsActionsCell><CmsRowActions actions={[{id:'view',label:'Xem chi tiết',icon:<Eye />,onClick:()=>openBooking(booking.id)}]} /></CmsActionsCell></TableRow>)}</TableBody>
            </Table>
          </TableContainer>

          <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {bookings.map((booking) => <Box key={booking.id} role="button" tabIndex={0}
              onClick={() => openBooking(booking.id)}
              onKeyDown={(event) => {
                if (!['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                openBooking(booking.id);
              }}
              sx={{ p: 2, cursor: 'pointer' }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'start' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{appointmentLabel(booking)}</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{booking.customerName || 'Khách'}</Typography>
                </Box>
                <Chip size="small" label={booking.status} color={statusColor(booking.status)} variant="outlined" />
              </Stack>
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                {booking.buildingCode || booking.buildingName || '-'} · {[booking.roomTypeName, booking.roomNumber].filter(Boolean).join(' · ') || 'Chưa chọn phòng'}
              </Typography>
              <Typography variant="caption" color="text.secondary">{nextAction(booking)}</Typography>
            <CmsRowActions actions={[{id:'view',label:'Xem chi tiết',icon:<Eye />,onClick:()=>openBooking(booking.id)}]} /></Box>)}
          </Stack>
        </>}

      {query.data && <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="Số dòng:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        onPageChange={(_, value) => setPage(value)}
        onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        sx={{ borderTop: 1, borderColor: 'divider' }}
      />}
    </CmsListCard>

    {createOpen && canCreateBooking && <BookingCreateDialog
      initialCustomerId={createForCustomer}
      onClose={closeCreate}
      onCreated={(id) => {
        closeCreate();
        openBooking(id);
        void query.refetch();
      }}
    />}

    {selectedId && <BookingDetailsDialog
      bookingId={selectedId}
      currentUser={currentUser}
      onClose={closeBooking}
    />}
  </Stack>;
}
