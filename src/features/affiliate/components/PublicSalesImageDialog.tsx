import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, useMediaQuery, useTheme } from '@mui/material';
import { X } from 'lucide-react';
import type { PublicRoomSearchQuery } from '@tinyhouse/contracts';
import { SalesImageCollection } from './SalesImageCollection';
import { validSalesImagePhone } from '../publicSalesImage';

/** Public inventory only. Contact is local export text, never an account/profile mutation. */
export function PublicSalesImageDialog({ onClose, searchParams }: {
  onClose: () => void; searchParams: Partial<PublicRoomSearchQuery>;
}) {
  const mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const validPhone = validSalesImagePhone(phone.trim());
  return <Dialog open onClose={onClose} fullScreen={mobile} fullWidth maxWidth="lg" scroll="paper" aria-labelledby="public-sales-image-title">
    <DialogTitle id="public-sales-image-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, fontSize: 20 }}>
      Tạo ảnh gửi khách
      <IconButton aria-label="Đóng tạo ảnh" onClick={onClose} sx={{ width: 44, height: 44 }}><X size={22} /></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField fullWidth label="Tên liên hệ" value={name} onChange={event => setName(event.target.value)} slotProps={{ htmlInput: { maxLength: 60, autoComplete: 'name' } }} />
          <TextField fullWidth required type="tel" label="Số điện thoại" value={phone}
            onChange={event => setPhone(event.target.value)} onBlur={() => setPhoneTouched(true)}
            error={phoneTouched && !validPhone} helperText={phoneTouched && !validPhone ? 'Vui lòng nhập số điện thoại hợp lệ.' : undefined}
            slotProps={{ htmlInput: { maxLength: 30, inputMode: 'tel', autoComplete: 'tel' } }} />
        </Stack>
        <SalesImageCollection phone={phone.trim()} name={name.trim()} ready={validPhone} searchParams={searchParams} />
      </Stack>
    </DialogContent>
  </Dialog>;
}
