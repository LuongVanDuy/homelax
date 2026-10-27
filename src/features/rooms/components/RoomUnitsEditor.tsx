import { CmsBadge as Chip } from '../../../components/cms';
import { Box, Button, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import type { RoomUnitStatus, RoomUnitWrite } from '@tinyhouse/contracts';
import { unitStatusColor, unitStatusLabel } from '../roomPresentation';

export type UnitDraft = RoomUnitWrite & {
  localId: string;
  persistedId?: string;
};

export function RoomUnitsEditor({
  units,
  disabled,
  readOnly,
  onChange,
}: {
  units: UnitDraft[];
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (units: UnitDraft[]) => void;
}) {
  const add = () => onChange([
    ...units,
    {
      localId: `new-${Date.now()}-${units.length}`,
      code: '',
      status: 'available',
      availableFrom: null,
    },
  ]);

  const update = (localId: string, patch: Partial<UnitDraft>) => {
    onChange(units.map((unit) =>
      unit.localId === localId
        ? {
          ...unit,
          ...patch,
          ...(patch.status === 'available' || patch.status === 'archived'
            ? { availableFrom: null }
            : {}),
        }
        : unit,
    ));
  };

  const remove = (localId: string) => {
    onChange(units.filter((unit) => unit.localId !== localId));
  };

  return <Stack spacing={1.25}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>Căn vật lý</Typography>
        <Typography variant="caption" color="text.secondary">
          Mỗi dòng là một căn thật. Không tạo căn từ số lượng.
        </Typography>
      </Box>
      {!readOnly && <Button variant="outlined" startIcon={<Plus size={17} />} onClick={add} disabled={disabled}>
        Thêm căn
      </Button>}
    </Stack>

    {!units.length ? <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center', borderStyle: 'dashed' }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>Chưa có căn vật lý</Typography>
      <Typography variant="caption" color="text.secondary">Loại phòng có thể được tạo trước, sau đó thêm từng mã căn thực tế.</Typography>
    </Paper> : <Stack spacing={1}>
      {units.map((unit, index) => {
        const status = unit.status as RoomUnitStatus;
        const dateEnabled = status === 'occupied' || status === 'maintenance';
        return <Paper key={unit.localId} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.25, alignItems: 'center', gridTemplateColumns: { xs: '1fr', md: 'minmax(150px, .9fr) minmax(150px, .9fr) minmax(170px, 1fr) auto' } }}>
            <TextField
              size="small"
              label={`Mã căn ${index + 1}`}
              value={unit.code}
              disabled={disabled || readOnly}
              onChange={(event) => update(unit.localId, { code: event.target.value })}
            />
            <TextField
              select
              size="small"
              label="Trạng thái"
              value={status}
              disabled={disabled || readOnly}
              onChange={(event) => update(unit.localId, { status: event.target.value as RoomUnitStatus })}
            >
              <MenuItem value="available">Trống</MenuItem>
              <MenuItem value="occupied">Đang thuê</MenuItem>
              <MenuItem value="maintenance">Bảo trì</MenuItem>
              <MenuItem value="archived">Lưu trữ</MenuItem>
            </TextField>
            <TextField
              size="small"
              type="date"
              label="Dự kiến trống"
              value={unit.availableFrom || ''}
              disabled={disabled || readOnly || !dateEnabled}
              onChange={(event) => update(unit.localId, { availableFrom: event.target.value || null })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: { xs: 'space-between', md: 'end' } }}>
              <Chip size="small" color={unitStatusColor(status)} variant="outlined" label={unitStatusLabel(status)} />
              {!readOnly && <Tooltip title="Bỏ căn khỏi lần lưu này"><span>
                <IconButton color="error" disabled={disabled} onClick={() => remove(unit.localId)}><Trash2 size={18} /></IconButton>
              </span></Tooltip>}
            </Stack>
          </Box>
        </Paper>;
      })}
    </Stack>}
  </Stack>;
}
