import { CmsBadge as Chip } from '../../../components/cms';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';
import { Building2, MapPin, Phone, UserRound } from 'lucide-react';
import type { BuildingRecord } from '../building.types';
import { formatPriceRange, hasBuildingLocation } from '../buildingPresentation';

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ mt: 0.25, fontWeight: 600, overflowWrap: 'anywhere' }}>{value === '' || value == null ? '-' : value}</Typography></Box>;
}

export function BuildingDetailsDialog({ building, onEdit, onClose }: { building: BuildingRecord; onEdit: () => void; onClose: () => void }) {
  return <Dialog open fullWidth maxWidth="md" onClose={onClose}>
    <DialogTitle><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Building2 size={22} /><Box><Typography sx={{ fontWeight: 800 }}>{building.name}</Typography><Typography variant="caption" color="text.secondary">{building.code}</Typography></Box>
    </Stack></DialogTitle>
    <DialogContent dividers>
      <Stack spacing={3}>
        {building.images.length > 0 && <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' } }}>
          {building.images.slice(0, 8).map((image, index) => <Box component="img" key={image + index} src={image} alt="" sx={{ width: '100%', aspectRatio: index === 0 ? '4 / 3' : '1', objectFit: 'cover', borderRadius: 2, gridColumn: { xs: index === 0 ? 'span 2' : 'auto', sm: index === 0 ? 'span 2' : 'auto' }, gridRow: { sm: index === 0 ? 'span 2' : 'auto' } }} />)}
        </Box>}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip label={building.ownerType === 'tiny' ? 'Tòa Homelax' : 'Tòa đối tác'} color={building.ownerType === 'tiny' ? 'primary' : 'default'} variant="outlined" />
          <Chip label={building.status === 'archived' ? 'Đã lưu trữ' : 'Đang hoạt động'} color={building.status === 'archived' ? 'warning' : 'success'} variant="outlined" />
          <Chip label={hasBuildingLocation(building) ? 'Đã định vị' : 'Chưa có tọa độ'} icon={<MapPin size={14} />} variant="outlined" />
        </Stack>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
          <Detail label="Địa chỉ" value={[building.address, building.ward].filter(Boolean).join(', ')} />
          <Detail label="Số phòng trống" value={building.vacantRoomsCount} />
          <Detail label="Khoảng giá" value={formatPriceRange(building)} />
          <Detail label="Vĩ độ" value={building.latitude} />
          <Detail label="Kinh độ" value={building.longitude} />
          <Detail label="Số ảnh" value={building.images.length} />
        </Box>
        <Divider />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><UserRound size={18} /><Typography sx={{ fontWeight: 800 }}>Chủ nhà / người quản lý</Typography></Stack>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
          <Detail label="Họ tên" value={building.hostName} />
          <Detail label="Số điện thoại" value={building.hostPhone} />
          <Detail label="Email" value={building.hostEmail} />
          <Detail label="Địa chỉ" value={building.hostAddress} />
        </Box>
        {building.hostPhone && <Button size="small" startIcon={<Phone size={16} />} href={`tel:${building.hostPhone}`} sx={{ alignSelf: 'flex-start' }}>Gọi chủ nhà</Button>}
      </Stack>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2.5 }}><Button color="inherit" onClick={onClose}>Đóng</Button><Button variant="contained" onClick={onEdit}>Chỉnh sửa</Button></DialogActions>
  </Dialog>;
}
