import { Box, ButtonBase } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Phone } from 'lucide-react';
import { publicSite } from './publicSite';
import { useLocation } from 'react-router';

export function PublicQuickContact() {
  const roomDetail = useLocation().pathname.startsWith('/phong/');
  return <Box component="nav" aria-label="Liên hệ nhanh" sx={{
    position: 'fixed', right: { xs: 16, md: 28 }, bottom: { xs: `calc(${roomDetail ? 100 : 24}px + env(safe-area-inset-bottom, 0px))`, lg: 'calc(24px + env(safe-area-inset-bottom, 0px))' },
    zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontFamily: theme => theme.typography.fontFamily,
    '@keyframes contact-ring': {
      '0%, 65%, 100%': { transform: 'scale(1)', opacity: 0 },
      '8%': { opacity: 0.45 },
      '45%': { transform: 'scale(1.35)', opacity: 0 },
    },
    '@keyframes contact-wave': {
      '0%, 8%, 20%, 100%': { transform: 'rotate(0deg)' },
      '11%, 17%': { transform: 'rotate(-12deg)' },
      '14%': { transform: 'rotate(12deg)' },
    },
    '& .contact-link': { gap: 1.25, borderRadius: 8, color: 'text.primary', textDecoration: 'none', overflow: 'visible' },
    '& .contact-label': {
      display: { xs: 'none', sm: 'block' },
      bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 5,
      px: 1.5, py: 0.625, fontSize: 12, fontWeight: 700, lineHeight: 1.5,
      boxShadow: '0 2px 10px rgba(16,29,48,.12)',
    },
    '& .contact-icon': {
      position: 'relative', display: 'grid', placeItems: 'center', flexShrink: 0,
      width: { xs: 52, md: 56 }, height: { xs: 52, md: 56 }, borderRadius: '50%',
      bgcolor: 'primary.main', color: 'primary.contrastText', border: '2px solid', borderColor: 'background.paper',
      boxShadow: theme => `0 4px 16px ${alpha(theme.palette.primary.main, 0.35)}`,
      transition: 'transform 180ms ease, background-color 180ms ease',
      '&::before': { content: '""', position: 'absolute', inset: -5, border: '2px solid', borderColor: 'primary.main', borderRadius: '50%', opacity: 0, animation: 'contact-ring 5s ease-out infinite', pointerEvents: 'none' },
    },
    '& .contact-phone': { animation: 'contact-wave 5s ease-in-out infinite' },
    '& .contact-link:nth-of-type(2) .contact-icon::before': { animationDelay: '2.5s' },
    '& .contact-link:hover .contact-icon': { bgcolor: 'primary.dark', transform: 'translateY(-2px)' },
    '& .contact-link:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 5 },
    '@media (prefers-reduced-motion: reduce)': {
      '& .contact-icon, & .contact-phone, & .contact-icon::before': { animation: 'none', transition: 'none' },
      '& .contact-link:hover .contact-icon': { transform: 'none' },
    },
  }}>
    <ButtonBase component="a" className="contact-link" href={`tel:${publicSite.phone}`} aria-label={`Gọi Hotline ${publicSite.phone}`}>
      <Box component="span" className="contact-label">Hotline</Box>
      <Box component="span" className="contact-icon"><Phone className="contact-phone" size={24} aria-hidden="true" /></Box>
    </ButtonBase>
    <ButtonBase component="a" className="contact-link" href={publicSite.zaloUrl} target="_blank" rel="noopener noreferrer" aria-label="Tư vấn qua Zalo">
      <Box component="span" className="contact-label">Zalo</Box>
      <Box component="span" className="contact-icon"><Box component="img" src="/brands/zalo.svg" alt="" aria-hidden="true" sx={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }} /></Box>
    </ButtonBase>
  </Box>;
}
