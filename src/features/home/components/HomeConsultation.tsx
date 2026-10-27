import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import { MessageCircle, X } from 'lucide-react';
import { PublicContainer } from '../../../components/public';
import { PublicIntakeForm } from '../../intake/PublicIntakeForm';

const dismissedKey = 'homelax:home-consultation-dismissed';

export function HomeConsultation() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem(dismissedKey)) return; } catch { /* Storage is optional. */ }
    const timer = window.setTimeout(() => {
      // Do not interrupt typing, another dialog, or a background tab.
      if (document.visibilityState !== 'visible' || Array.from(document.querySelectorAll('[role="dialog"]')).some(el => getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0)
        || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
      setOpen(true);
      try { sessionStorage.setItem(dismissedKey, '1'); } catch { /* No personal data is stored. */ }
    }, 20000);
    return () => window.clearTimeout(timer);
  }, []);
  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(dismissedKey, '1'); } catch { /* No personal data is stored. */ }
  };
  return <>
    <Box component="section" sx={{ bgcolor: '#fff7ed', py: { xs: 3, md: 4 } }}>
      <PublicContainer>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
          <Box><Typography component="h2" sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800 }}>Cần Homelax hỗ trợ?</Typography>
            <Typography color="text.secondary" sx={{ mt: .5 }}>Thuê phòng, lắp phòng hoặc quản lý vận hành.</Typography></Box>
          <Button variant="contained" startIcon={<MessageCircle size={18} />} onClick={() => setOpen(true)} sx={{ whiteSpace: 'nowrap', flexShrink: 0, minHeight: 44 }}>Đăng ký tư vấn</Button>
        </Stack>
      </PublicContainer>
    </Box>
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth keepMounted aria-label="Đăng ký tư vấn Homelax"
      slotProps={{ paper: { sx: { borderRadius: 3, m: 2, width: 'calc(100% - 32px)' } } }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 1 }}>
        <IconButton onClick={close} aria-label="Đóng tư vấn" sx={{ width: 44, height: 44 }}><X size={22} /></IconButton>
      </Box>
      <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, pt: 0, pb: 3 }}>
        <PublicIntakeForm kind="general_contact" consultation />
      </DialogContent>
    </Dialog>
  </>;
}
