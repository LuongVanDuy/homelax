import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { X } from 'lucide-react';
import type { PublicSearch } from '../../../app/router/publicSearch';
import { SearchBasicFilters } from './SearchBasicFilters';

export function SearchFilterDialog({ open, onClose, onAfterClose, filters, onChange, onReset, total, pending, error }: {
  open: boolean;
  onClose: () => void;
  onAfterClose: () => void;
  filters: PublicSearch;
  onChange: (patch: Partial<PublicSearch>, replace?: boolean) => void;
  onReset: () => void;
  total: number;
  pending: boolean;
  error: boolean;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  return <Dialog id="search-filter-dialog" open={open} onClose={onClose} fullScreen={mobile} fullWidth maxWidth="lg"
    aria-labelledby="search-filter-title" scroll="paper"
    slotProps={{ transition: { onExited: onAfterClose }, paper: { sx: { maxWidth: mobile ? '100%' : 980, borderRadius: mobile ? 0 : 2.5 } } }}>
    <DialogTitle id="search-filter-title" sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', px: { xs: 1.5, sm: 2 }, py: 1.1, fontSize: 18 }}>
      Bộ lọc tìm kiếm
      <IconButton aria-label="Đóng bộ lọc" onClick={onClose} sx={{ width: 44, height: 44, flexShrink: 0 }}>
        <X size={20} aria-hidden="true" />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ px: { xs: 1.5, sm: 2 }, py: 1.75 }}>
      {open && <SearchBasicFilters filters={filters} onChange={onChange} />}
    </DialogContent>
    <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, gap: .75, flexWrap: 'wrap' }}>
      <Stack sx={{ mr: 'auto' }}>
        <Typography role="status" sx={{ fontSize: 14, color: 'text.secondary' }}>
          {pending ? 'Đang tìm tòa nhà…' : error ? 'Chưa tải được kết quả' : `${total.toLocaleString('vi-VN')} tòa nhà phù hợp`}
        </Typography>
      </Stack>
      <Button onClick={onReset} sx={{ minHeight: 44 }}>Đặt lại</Button>
      <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>Xem kết quả</Button>
    </DialogActions>
  </Dialog>;
}
