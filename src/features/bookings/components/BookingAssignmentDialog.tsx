import { useMemo, useState } from 'react';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { BookingAssignee, BookingSummary } from '@tinyhouse/contracts';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { updateAutocompleteSearch, useStableAutocompleteOptions } from '../../../hooks/useStableAutocompleteOptions';
import { toast } from '../../../lib/toast';
import { useAssignBookingMutation, useBookingAssigneesQuery } from '../api';

function fallbackAssignee(booking: BookingSummary): BookingAssignee | null {
  if (!booking.assignedUserId) return null;
  return {
    id: booking.assignedUserId,
    name: booking.assignedUserName || booking.assignedUserId,
    email: booking.assignedUserEmail || '',
    roleCode: '',
    roleName: 'Người phụ trách hiện tại',
    bookingScope: 'assigned',
  };
}

export function BookingAssignmentDialog({
  booking,
  canReassign,
  onClose,
  onSaved,
}: {
  booking: BookingSummary;
  canReassign: boolean;
  onClose: () => void;
  onSaved: (booking: BookingSummary) => void;
}) {
  const [search, setSearch] = useState(booking.assignedUserName || '');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    booking.assignedUserId,
  );
  const debouncedSearch = useDebouncedValue(search, 250);
  const assigneesQuery = useBookingAssigneesQuery(debouncedSearch);
  const assignMutation = useAssignBookingMutation();

  const queryOptions = useMemo(() => {
    const eligible = assigneesQuery.data || [];
    const current = fallbackAssignee(booking);
    if (current && !eligible.some((user) => user.id === current.id)) {
      return [current, ...eligible];
    }
    return eligible;
  }, [assigneesQuery.data, booking]);
  const assigneeAutocomplete = useStableAutocompleteOptions(
    queryOptions,
    selectedUserId ? [selectedUserId] : [],
    (user) => user.id,
  );
  const options = assigneeAutocomplete.options;

  const selected = options.find((user) => user.id === selectedUserId) || null;
  const busy = assignMutation.isPending;

  const save = async () => {
    try {
      const saved = await assignMutation.mutateAsync({
        id: booking.id,
        assignment: { assignedUserId: selectedUserId },
      });
      toast.success(
        selectedUserId ? 'Đã cập nhật người phụ trách lịch xem.' : 'Đã gỡ phân công lịch xem.',
      );
      onSaved(saved);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật phân công.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose}>
    <DialogTitle>Phân công lịch xem</DialogTitle>
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

        <Autocomplete
          options={options}
          value={selected}
          loading={assigneesQuery.isFetching}
          disableClearable={Boolean(booking.assignedUserId && !canReassign)}
          onChange={(_, user) => {
            assigneeAutocomplete.rememberOption(user);
            setSelectedUserId(user?.id || null);
          }}
          onInputChange={(_, value, reason) => {
            updateAutocompleteSearch(setSearch, value, reason);
          }}
          getOptionLabel={(user) =>
            [user.name || user.email || user.id, user.roleName]
              .filter(Boolean)
              .join(' · ')}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          noOptionsText={assigneesQuery.isFetching ? 'Đang tải…' : 'Không có tài khoản phù hợp'}
          renderOption={(props, user) => <li {...props} key={user.id}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {user.name || user.email || user.id}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[user.email, user.roleName || user.roleCode].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </li>}
          renderInput={(params) => <TextField
            {...params}
            label="Người phụ trách"
            placeholder="Tìm tên hoặc email"
            helperText="Chỉ hiện tài khoản hoạt động có chính sách Lịch xem phù hợp."
          />}
        />

        {booking.assignedUserId && canReassign && <Typography variant="caption" color="text.secondary">
          Xóa lựa chọn để gỡ người phụ trách hiện tại.
        </Typography>}
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={busy}>Hủy</Button>
      <Button variant="contained" onClick={() => void save()} disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu phân công'}
      </Button>
    </DialogActions>
  </Dialog>;
}
