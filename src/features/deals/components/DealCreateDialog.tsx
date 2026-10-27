import { useMemo, useState } from 'react';
import type { CustomerSummary } from '@tinyhouse/contracts';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { updateAutocompleteSearch, useStableAutocompleteOptions } from '../../../hooks/useStableAutocompleteOptions';
import { toast } from '../../../lib/toast';
import { useBookingsPageQuery } from '../../bookings/api';
import { useContactsPageQuery } from '../../contacts/api';
import { useRoomsQuery } from '../../rooms/api';
import { useCreateDealDirectMutation, useCreateDealFromBookingMutation, useDealAssigneesQuery } from '../api';

type DealCreateMode = 'booking' | 'direct';

type UnitOption = {
  id: string;
  code: string;
  status: string;
  buildingId: string;
  buildingCode: string;
  buildingName: string;
  roomTypeId: string;
  roomTypeName: string;
};

export function DealCreateDialog({
  canCreateDirect,
  initialBookingId,
  initialCustomerId,
  onClose,
  onCreated,
}: {
  canCreateDirect: boolean;
  initialBookingId?: string;
  initialCustomerId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const initialMode: DealCreateMode = initialCustomerId && canCreateDirect ? 'direct' : 'booking';
  const [mode, setMode] = useState<DealCreateMode>(initialMode);
  const [bookingSearch, setBookingSearch] = useState(initialBookingId || '');
  const [bookingId, setBookingId] = useState(initialBookingId || '');
  const [customerSearch, setCustomerSearch] = useState(initialCustomerId || '');
  const [customerId, setCustomerId] = useState(initialCustomerId || '');
  const [roomUnitId, setRoomUnitId] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [contractMonths, setContractMonths] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [notes, setNotes] = useState('');

  const debouncedBookingSearch = useDebouncedValue(bookingSearch, 300);
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 300);

  const bookingsQuery = useBookingsPageQuery({
    page: 1,
    pageSize: 100,
    search: debouncedBookingSearch,
    sort: 'createdAt',
    order: 'desc',
  }, mode === 'booking');

  const customersQuery = useContactsPageQuery('customers', {
    page: 1,
    pageSize: 100,
    search: debouncedCustomerSearch,
    archived: 'active',
    sort: 'name',
    order: 'asc',
  }, mode === 'direct');

  const roomsQuery = useRoomsQuery('cms');
  const assigneesQuery = useDealAssigneesQuery(mode === 'direct');
  const fromBookingMutation = useCreateDealFromBookingMutation();
  const directMutation = useCreateDealDirectMutation();
  const busy = fromBookingMutation.isPending || directMutation.isPending;

  const bookingResults = (bookingsQuery.data?.items || []).filter((item) =>
    Boolean(item.customerId)
    && !item.dealId
    && ['Đã xem phòng', 'Đã cọc', 'Đã chốt'].includes(item.status),
  );
  const bookingAutocomplete = useStableAutocompleteOptions(
    bookingResults,
    bookingId ? [bookingId] : [],
    (item) => item.id,
  );
  const bookings = bookingAutocomplete.options;
  const selectedBooking = bookings.find((item) => item.id === bookingId) || null;

  const customerResults = (customersQuery.data?.items || []) as CustomerSummary[];
  const customerAutocomplete = useStableAutocompleteOptions(
    customerResults,
    customerId ? [customerId] : [],
    (item) => item.id,
  );
  const customers = customerAutocomplete.options;
  const selectedCustomer = customers.find((item) => item.id === customerId) || null;

  const units = useMemo<UnitOption[]>(() => (roomsQuery.data || []).flatMap((room) =>
    (room.roomUnits || [])
      .filter((unit) => unit.status === 'available')
      .map((unit) => ({
        id: unit.id,
        code: unit.code,
        status: unit.status,
        buildingId: room.buildingId,
        buildingCode: room.buildingCode,
        buildingName: room.buildingName,
        roomTypeId: room.id,
        roomTypeName: room.type,
      })),
  ), [roomsQuery.data]);

  const suggestedUnitId = selectedBooking
    ? units.find((unit) =>
      unit.buildingId === selectedBooking.buildingId
      && selectedBooking.roomNumber
      && unit.code.toLowerCase() === selectedBooking.roomNumber.toLowerCase(),
    )?.id || ''
    : '';
  const effectiveRoomUnitId = roomUnitId || suggestedUnitId;
  const selectedUnit = units.find((item) => item.id === effectiveRoomUnitId) || null;

  const chooseBooking = (nextId: string) => {
    setBookingId(nextId);
    setRoomUnitId('');
  };

  const changeMode = (nextMode: DealCreateMode | null) => {
    if (!nextMode || nextMode === mode) return;
    setMode(nextMode);
    setBookingId('');
    setCustomerId('');
    setBookingSearch('');
    setCustomerSearch('');
    setRoomUnitId('');
    setAssignedUserId('');
  };

  const submit = async () => {
    const priceText = finalPrice.trim();
    const price = Number(priceText);
    const monthsText = contractMonths.trim();
    const months = monthsText ? Number(monthsText) : null;
    if (!effectiveRoomUnitId || !priceText || !Number.isFinite(price) || price < 0) {
      toast.error('Vui lòng chọn căn thuê thực tế và nhập giá thuê / tháng hợp lệ.');
      return;
    }
    if (months !== null && (!Number.isInteger(months) || months <= 0)) {
      toast.error('Số tháng hợp đồng phải là số nguyên lớn hơn 0 hoặc để trống.');
      return;
    }
    if (mode === 'booking' && !bookingId) {
      toast.error('Vui lòng chọn lịch xem đã hoàn tất.');
      return;
    }
    if (mode === 'direct' && !customerId) {
      toast.error('Vui lòng chọn khách hàng.');
      return;
    }

    try {
      const result = mode === 'booking'
        ? await fromBookingMutation.mutateAsync({
            bookingId,
            roomUnitId: effectiveRoomUnitId,
            finalPrice: price,
            contractMonths: months,
            notes,
          })
        : await directMutation.mutateAsync({
            customerId,
            roomUnitId: effectiveRoomUnitId,
            finalPrice: price,
            contractMonths: months,
            assignedUserId: assignedUserId || null,
            notes,
          });

      toast.success(mode === 'booking'
        ? 'Đã tạo giao dịch từ lịch xem.'
        : 'Đã tạo giao dịch trực tiếp.');
      onCreated(result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo giao dịch thuê.');
    }
  };

  return <Dialog open fullWidth maxWidth="md" onClose={busy ? undefined : onClose}>
    <DialogTitle>Tạo giao dịch thuê</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2.25}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          onChange={(_, value) => changeMode(value)}
          disabled={busy || Boolean(initialBookingId || initialCustomerId)}
        >
          <ToggleButton value="booking">Từ lịch xem</ToggleButton>
          {canCreateDirect && <ToggleButton value="direct">Tạo trực tiếp</ToggleButton>}
        </ToggleButtonGroup>

        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {mode === 'booking' ? 'Khách đã xem phòng và muốn thuê' : 'Khách thuê trực tiếp không qua lịch xem'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {mode === 'booking'
              ? 'Thông tin khách, nguồn và người phụ trách được kế thừa từ lịch xem.'
              : 'Chọn khách, căn thực tế, giá thuê tháng, thời hạn hợp đồng và người phụ trách giao dịch.'}
          </Typography>
        </Box>

        {mode === 'booking' ? <>
          <Autocomplete
            options={bookings}
            value={selectedBooking}
            loading={bookingsQuery.isFetching}
            onChange={(_, item) => {
              bookingAutocomplete.rememberOption(item);
              chooseBooking(item?.id || '');
            }}
            onInputChange={(_, value, reason) => updateAutocompleteSearch(setBookingSearch, value, reason)}
            getOptionLabel={(item) =>
              `${item.id} · ${item.customerName} · ${item.buildingCode || item.buildingName}`
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={bookingsQuery.isFetching ? 'Đang tải…' : 'Không có lịch đã xem phù hợp'}
            renderInput={(params) => <TextField
              {...params}
              label="Lịch xem nguồn"
              placeholder="Tìm mã lịch, khách, SĐT…"
            />}
          />

          {selectedBooking && <Box sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}>
            <Typography variant="body2"><strong>Khách:</strong> {selectedBooking.customerName}</Typography>
            <Typography variant="body2"><strong>Trạng thái:</strong> {selectedBooking.status}</Typography>
            <Typography variant="body2">
              <strong>Phòng đã xem:</strong> {[selectedBooking.buildingCode, selectedBooking.roomTypeName, selectedBooking.roomNumber]
                .filter(Boolean).join(' · ') || 'Chưa xác định'}
            </Typography>
            <Typography variant="body2">
              <strong>Phụ trách:</strong> {selectedBooking.assignedUserName || 'Chưa phân công'}
            </Typography>
          </Box>}
        </> : <>
          <Autocomplete
            options={customers}
            value={selectedCustomer}
            loading={customersQuery.isFetching}
            onChange={(_, item) => {
              customerAutocomplete.rememberOption(item);
              setCustomerId(item?.id || '');
            }}
            onInputChange={(_, value, reason) => updateAutocompleteSearch(setCustomerSearch, value, reason)}
            getOptionLabel={(item) => `${item.name} · ${item.phone || item.email || item.id}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={customersQuery.isFetching ? 'Đang tải…' : 'Không có khách hàng phù hợp'}
            renderInput={(params) => <TextField
              {...params}
              label="Khách hàng"
              placeholder="Tìm tên, SĐT, email…"
            />}
          />

          <TextField
            select
            label="Người phụ trách"
            value={assignedUserId}
            onChange={(event) => setAssignedUserId(event.target.value)}
          >
            <MenuItem value="">Chưa phân công</MenuItem>
            {(assigneesQuery.data || []).map((user) => <MenuItem key={user.id} value={user.id}>
              {user.name || user.email} · {user.roleName}
            </MenuItem>)}
          </TextField>
        </>}

        <Autocomplete
          options={units}
          value={selectedUnit}
          loading={roomsQuery.isFetching}
          onChange={(_, item) => setRoomUnitId(item?.id || '')}
          getOptionLabel={(item) => `${item.buildingCode} · ${item.roomTypeName} · ${item.code}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          groupBy={(item) => `${item.buildingCode} · ${item.buildingName}`}
          renderInput={(params) => <TextField
            {...params}
            label="Căn thuê thực tế"
            placeholder="Chọn căn đang trống"
          />}
        />

        <Box sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        }}>
          <TextField
            label="Giá thuê / tháng"
            type="number"
            value={finalPrice}
            onChange={(event) => setFinalPrice(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 100000 } }}
            helperText="Giá chốt của một tháng, không phải tổng giá trị hợp đồng."
          />
          <TextField
            label="Số tháng hợp đồng (tùy chọn)"
            type="number"
            value={contractMonths}
            onChange={(event) => setContractMonths(event.target.value)}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            helperText="Để trống nếu chưa chốt; không suy từ ngày bắt đầu/kết thúc."
          />
        </Box>

        <TextField
          label="Ghi chú ban đầu"
          multiline
          minRows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Thông tin cần lưu ý khi xử lý giao dịch…"
        />
      </Stack>
    </DialogContent>

    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={busy}>Hủy</Button>
      <Button
        variant="contained"
        onClick={() => void submit()}
        disabled={busy || !effectiveRoomUnitId || (mode === 'booking' ? !bookingId : !customerId)}
      >
        {busy ? 'Đang tạo…' : 'Tạo giao dịch'}
      </Button>
    </DialogActions>
  </Dialog>;
}
