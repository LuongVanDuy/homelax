import { useMemo, useState } from 'react';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { DealSummary } from '@tinyhouse/contracts';
import { toast } from '../../../lib/toast';
import { useRoomsQuery } from '../../rooms/api';
import { useChangeDealRoomUnitMutation } from '../api';

type UnitOption = {
  id: string;
  code: string;
  status: string;
  buildingCode: string;
  buildingName: string;
  roomTypeName: string;
};

export function DealRoomUnitDialog({
  deal,
  onClose,
  onUpdated,
}: {
  deal: DealSummary;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const roomsQuery = useRoomsQuery('cms');
  const mutation = useChangeDealRoomUnitMutation();
  const [roomUnitId, setRoomUnitId] = useState('');

  const units = useMemo<UnitOption[]>(() => (roomsQuery.data || []).flatMap((room) =>
    (room.roomUnits || [])
      .filter((unit) => unit.status === 'available' && unit.id !== deal.roomUnitId)
      .map((unit) => ({
        id: unit.id,
        code: unit.code,
        status: unit.status,
        buildingCode: room.buildingCode,
        buildingName: room.buildingName,
        roomTypeName: room.type,
      })),
  ), [roomsQuery.data, deal.roomUnitId]);
  const selected = units.find((unit) => unit.id === roomUnitId) || null;

  const submit = async () => {
    if (!roomUnitId) {
      toast.error('Vui lòng chọn căn mới.');
      return;
    }
    try {
      await mutation.mutateAsync({ id: deal.id, change: { roomUnitId } });
      toast.success('Đã đổi căn và lưu lịch sử giao dịch.');
      onUpdated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi căn.');
    }
  };

  return <Dialog open fullWidth maxWidth="sm" onClose={mutation.isPending ? undefined : onClose}>
    <DialogTitle>Đổi căn thực tế</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>Căn hiện tại: {deal.buildingCode} · {deal.roomUnitCode}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Đổi căn sẽ trả căn cũ về trạng thái trống, trừ khi đang bảo trì hoặc đã lưu trữ. Căn mới phải đang trống; nếu giao dịch đã ký hợp đồng và đủ cọc thì căn mới chuyển sang đang thuê, với ngày dự kiến trống theo ngày kết thúc thuê.
          </Typography>
        </Box>
        <Autocomplete
          options={units}
          value={selected}
          loading={roomsQuery.isFetching}
          onChange={(_, unit) => setRoomUnitId(unit?.id || '')}
          getOptionLabel={(unit) => `${unit.buildingCode} · ${unit.roomTypeName} · ${unit.code}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          groupBy={(unit) => `${unit.buildingCode} · ${unit.buildingName}`}
          noOptionsText={roomsQuery.isFetching ? 'Đang tải…' : 'Không có căn trống phù hợp'}
          renderInput={(params) => <TextField {...params} label="Căn mới" placeholder="Chọn căn đang trống" />}
        />
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
      <Button variant="contained" onClick={() => void submit()} disabled={mutation.isPending || !roomUnitId}>
        {mutation.isPending ? 'Đang đổi…' : 'Đổi căn'}
      </Button>
    </DialogActions>
  </Dialog>;
}