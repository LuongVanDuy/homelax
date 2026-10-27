import { CmsBadge as Chip } from '../../../components/cms';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';
import { Building2, DoorOpen, Pencil } from 'lucide-react';
import type { RoomType } from '@tinyhouse/contracts';
import { formatMoney, unitStatusColor, unitStatusLabel } from '../roomPresentation';
import { roomDescriptionDisplayHtml } from '../roomDescription';

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 700 }}>{value === '' || value == null ? '-' : value}</Typography>
  </Box>;
}

export function RoomDetailsDialog({
  room,
  onClose,
  onEdit,
}: {
  room: RoomType;
  onClose: () => void;
  onEdit: () => void;
}) {
  return <Dialog open fullWidth maxWidth="md" onClose={onClose}>
    <DialogTitle>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <DoorOpen size={22} />
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{room.type}</Typography>
          <Typography variant="caption" color="text.secondary">{room.buildingCode} · {room.buildingName}</Typography>
        </Box>
      </Stack>
    </DialogTitle>
    <DialogContent dividers>
      <Stack spacing={3}>
        {room.images.length > 0 && <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }}>
          {room.images.slice(0, 8).map((image, index) => <Box component="img" key={image + index} src={image} alt="" sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 2 }} />)}
        </Box>}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip icon={<Building2 size={14} />} label={room.buildingCode || room.buildingName} variant="outlined" />
          <Chip label={room.lifecycleStatus === 'archived' ? 'Đã lưu trữ' : 'Đang hoạt động'} color={room.lifecycleStatus === 'archived' ? 'warning' : 'success'} variant="outlined" />
          <Chip label={room.status} variant="outlined" />
        </Stack>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }}>
          <Detail label="Giá niêm yết" value={formatMoney(room.price)} />
          <Detail label="Diện tích" value={`${room.area} m²`} />
          <Detail label="Tối đa" value={`${room.maxOccupants} người`} />
          <Detail label="Tồn" value={`${room.vacantCount}/${room.totalUnits} căn trống`} />
        </Box>
        {room.description && <Box>
          <Typography variant="caption" color="text.secondary">Mô tả</Typography>
          <Box
            sx={{
              mt: 0.5,
              fontSize: '0.875rem',
              lineHeight: 1.7,
              color: 'text.primary',
              overflowWrap: 'anywhere',
              '& p': { my: 0.75 },
              '& p:first-of-type': { mt: 0 },
              '& p:last-of-type': { mb: 0 },
              '& ul, & ol': { my: 0.75, pl: 3 },
              '& li': { mb: 0.35 },
              '& a': { color: 'primary.main', textDecoration: 'underline' },
              '& blockquote': { my: 1, mx: 0, pl: 1.5, borderLeft: 3, borderColor: 'divider' },
              '& table': { width: '100%', borderCollapse: 'collapse', my: 1 },
              '& th, & td': { border: 1, borderColor: 'divider', p: 0.75, textAlign: 'left' },
            }}
            dangerouslySetInnerHTML={{ __html: roomDescriptionDisplayHtml(room.description) }}
          />
        </Box>}
        <Divider />
        <Typography sx={{ fontWeight: 800 }}>Danh sách căn ({room.roomUnits.length})</Typography>
        {!room.roomUnits.length ? <Typography variant="body2" color="text.secondary">Chưa có căn vật lý.</Typography> :
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            {room.roomUnits.map((unit) => <PaperUnit key={unit.id} unit={unit} />)}
          </Box>}
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button color="inherit" onClick={onClose}>Đóng</Button>
      <Button variant="contained" startIcon={<Pencil size={17} />} onClick={onEdit}>Chỉnh sửa</Button>
    </DialogActions>
  </Dialog>;
}

function PaperUnit({ unit }: { unit: RoomType['roomUnits'][number] }) {
  return <Box sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2 }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="body2" sx={{ fontWeight: 800 }}>{unit.code}</Typography>
      <Chip size="small" color={unitStatusColor(unit.status)} variant="outlined" label={unitStatusLabel(unit.status)} />
    </Stack>
    <Typography variant="caption" color="text.secondary">
      {unit.availableFrom ? `Dự kiến trống: ${unit.availableFrom}` : 'Chưa có ngày dự kiến trống'}
    </Typography>
  </Box>;
}
