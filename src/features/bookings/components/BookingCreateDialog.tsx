import { useMemo, useState } from 'react';
import type { CustomerSummary } from '@tinyhouse/contracts';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { DatePickerField } from '../../../components/ui/forms/DatePickerField';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { updateAutocompleteSearch, useStableAutocompleteOptions } from '../../../hooks/useStableAutocompleteOptions';
import { toast } from '../../../lib/toast';
import { useBuildingsPageQuery } from '../../buildings/api';
import { useContactsPageQuery } from '../../contacts/api';
import { useRoomsQuery } from '../../rooms/api';
import { useBookingAssigneesQuery, useCreateAdminBookingMutation } from '../api';

type UnitOption = {
  id: string;
  code: string;
  roomTypeId: string;
  roomTypeName: string;
  buildingId: string;
};

function todayLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function BookingCreateDialog({
  initialCustomerId,
  onClose,
  onCreated,
}: {
  initialCustomerId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [customerSearch, setCustomerSearch] = useState(initialCustomerId || '');
  const [customerId, setCustomerId] = useState(initialCustomerId || '');
  const [buildingSearch, setBuildingSearch] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomUnitId, setRoomUnitId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [notes, setNotes] = useState('');

  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 300);
  const debouncedBuildingSearch = useDebouncedValue(buildingSearch, 300);

  const customersQuery = useContactsPageQuery('customers', {
    page: 1,
    pageSize: 100,
    search: debouncedCustomerSearch,
    archived: 'active',
    sort: 'name',
    order: 'asc',
  });
  const buildingsQuery = useBuildingsPageQuery({
    scope: 'cms',
    page: 1,
    pageSize: 200,
    search: debouncedBuildingSearch,
    status: 'active',
    sort: 'name',
    order: 'asc',
  });
  const roomsQuery = useRoomsQuery('cms');
  const assigneesQuery = useBookingAssigneesQuery('');
  const createMutation = useCreateAdminBookingMutation();

  const customerResults = (customersQuery.data?.items || []) as CustomerSummary[];
  const customerAutocomplete = useStableAutocompleteOptions(
    customerResults,
    customerId ? [customerId] : [],
    (item) => item.id,
  );
  const customers = customerAutocomplete.options;
  const selectedCustomer = customers.find((item) => item.id === customerId) || null;

  const buildingAutocomplete = useStableAutocompleteOptions(
    buildingsQuery.data?.items || [],
    buildingId ? [buildingId] : [],
    (item) => item.id,
  );
  const buildings = buildingAutocomplete.options;
  const selectedBuilding = buildings.find((item) => item.id === buildingId) || null;

  const roomTypes = useMemo(
    () => (roomsQuery.data || []).filter((room) => room.buildingId === buildingId),
    [buildingId, roomsQuery.data],
  );
  const units = useMemo<UnitOption[]>(
    () => roomTypes.flatMap((room) => (room.roomUnits || [])
      .filter((unit) => unit.status !== 'archived')
      .map((unit) => ({
        id: unit.id,
        code: unit.code,
        roomTypeId: room.id,
        roomTypeName: room.type,
        buildingId: room.buildingId,
      }))),
    [roomTypes],
  );
  const selectedUnit = units.find((unit) => unit.id === roomUnitId) || null;

  const submit = async () => {
    if (!customerId || !buildingId || !roomUnitId || !appointmentDate || !appointmentTime) {
      toast.error('Vui lòng chọn khách, tòa nhà, căn cụ thể và thời gian xem.');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        customerId,
        roomUnitId,
        appointmentDate,
        appointmentTime,
        appointmentTimezoneOffsetMinutes: new Date().getTimezoneOffset(),
        notes,
        assignedUserId: assignedUserId || null,
      });
      toast.success('Đã tạo lịch xem mới.');
      onCreated(created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo lịch xem.');
    }
  };

  return <Dialog open fullWidth maxWidth="md" onClose={createMutation.isPending ? undefined : onClose}>
    <DialogTitle>Tạo lịch xem mới</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2.25}>
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>Lịch xem cho khách đã có trong CRM</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Nguồn khách và CTV được giữ nguyên từ hồ sơ Customer. Lịch mới chỉ ghi nhu cầu xem và người phụ trách.
          </Typography>
        </Box>

        <Autocomplete
          options={customers}
          value={selectedCustomer}
          loading={customersQuery.isFetching}
          disabled={Boolean(initialCustomerId)}
          onChange={(_, item) => {
            customerAutocomplete.rememberOption(item);
            setCustomerId(item?.id || '');
          }}
          onInputChange={(_, value, reason) => updateAutocompleteSearch(setCustomerSearch, value, reason)}
          getOptionLabel={(item) => `${item.name} · ${item.phone || item.email || item.id}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          noOptionsText={customersQuery.isFetching ? 'Đang tải…' : 'Không có khách hàng phù hợp'}
          renderInput={(params) => <TextField {...params} label="Khách hàng" />}
        />

        {selectedCustomer && <Box sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}>
          <Typography variant="body2"><strong>Liên hệ:</strong> {selectedCustomer.phone || selectedCustomer.email || '-'}</Typography>
          <Typography variant="body2">
            <strong>Nguồn:</strong> {[selectedCustomer.sourceType, selectedCustomer.sourceChannel].filter(Boolean).join(' · ') || 'Chưa ghi nhận'}
          </Typography>
        </Box>}

        <Autocomplete
          options={buildings}
          value={selectedBuilding}
          loading={buildingsQuery.isFetching}
          onChange={(_, item) => {
            buildingAutocomplete.rememberOption(item);
            setBuildingId(item?.id || '');
            setRoomTypeId('');
            setRoomUnitId('');
          }}
          onInputChange={(_, value, reason) => updateAutocompleteSearch(setBuildingSearch, value, reason)}
          getOptionLabel={(item) => `${item.code} · ${item.name}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField {...params} label="Tòa nhà" />}
        />

        <TextField
          select
          label="Loại phòng muốn xem"
          value={roomTypeId}
          disabled={!buildingId}
          onChange={(event) => {
            setRoomTypeId(event.target.value);
            setRoomUnitId('');
          }}
        >
          <MenuItem value="">Chưa xác định loại phòng</MenuItem>
          {roomTypes.map((room) => <MenuItem key={room.id} value={room.id}>
            {room.type}
          </MenuItem>)}
        </TextField>

        <Autocomplete
          options={roomTypeId ? units.filter((unit) => unit.roomTypeId === roomTypeId) : units}
          value={selectedUnit}
          disabled={!buildingId}
          onChange={(_, item) => {
            setRoomUnitId(item?.id || '');
            if (item?.roomTypeId) setRoomTypeId(item.roomTypeId);
          }}
          getOptionLabel={(item) => `${item.code} · ${item.roomTypeName}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField
            {...params}
            label="Căn cụ thể"
            placeholder="Chọn đúng căn khách sẽ xem"
          />}
        />

        <Box sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        }}>
          <DatePickerField
            label="Ngày xem"
            value={appointmentDate}
            minDate={todayLocal()}
            onChange={setAppointmentDate}
          />
          <TextField
            label="Giờ xem"
            type="time"
            value={appointmentTime}
            onChange={(event) => setAppointmentTime(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Thời gian phải cách hiện tại ít nhất 1 giờ."
          />
        </Box>

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

        <TextField
          label="Ghi chú"
          multiline
          minRows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Nhu cầu, lưu ý khi dẫn khách xem…"
        />
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={createMutation.isPending}>Hủy</Button>
      <Button
        variant="contained"
        onClick={() => void submit()}
        disabled={createMutation.isPending || !customerId || !buildingId || !roomUnitId || !appointmentDate || !appointmentTime}
      >
        {createMutation.isPending ? 'Đang tạo…' : 'Tạo lịch xem'}
      </Button>
    </DialogActions>
  </Dialog>;
}
