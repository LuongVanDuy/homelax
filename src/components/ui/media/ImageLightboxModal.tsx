import { useId, useState } from 'react';
import { Box, ButtonBase, CircularProgress, Dialog, IconButton, Stack, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
import { getTransformedImageUrl } from '../../../utils/imageTransformer';
import { designTokens as tokens } from '../../../app/theme/tokens';

type ImageLightboxProps = {
  isOpen: boolean;
  onClose: () => void;
  images: readonly string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  title?: string;
};

function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const transformed = getTransformedImageUrl(src, { variant: 'detail' });
  const [original, setOriginal] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const url = original ? src : transformed || src;
  return <>
    {status === 'loading' && <CircularProgress size={36} aria-label="Đang tải ảnh" sx={{ position: 'absolute' }} />}
    {status === 'error' ? <Stack role="status" sx={{ gap: 1, alignItems: 'center' }}>
      <ImageOff size={32} aria-hidden="true" /><Typography>Không tải được ảnh này.</Typography>
    </Stack> : <Box component="img" src={url} alt={alt}
      onLoad={() => setStatus('ready')}
      onError={() => {
        if (!original && url !== src) { setOriginal(true); setStatus('loading'); }
        else setStatus('error');
      }}
      sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 2, opacity: status === 'loading' ? 0 : 1 }} />}
  </>;
}

export default function ImageLightboxModal({ isOpen, onClose, images, currentIndex, onIndexChange, title = 'Chi tiết hình ảnh' }: ImageLightboxProps) {
  const headingId = useId();
  const index = Math.max(0, Math.min(currentIndex, images.length - 1));
  const move = (offset: number) => {
    if (images.length > 1) onIndexChange((index + offset + images.length) % images.length);
  };
  const controlStyle = { width: 44, height: 44, color: 'inherit', bgcolor: tokens.colors.navy[800],
    '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' } };
  return <Dialog open={isOpen && images.length > 0} onClose={onClose} fullScreen aria-labelledby={headingId}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    }}
    slotProps={{ paper: { sx: { bgcolor: tokens.colors.navy[900], color: tokens.colors.neutral[0], p: { xs: 1.5, sm: 3 }, gap: 2,
      '& button:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 } } } }}>
    <Stack direction="row" sx={{ alignItems: 'center', gap: 2, width: '100%', maxWidth: 1440, mx: 'auto' }}>
      <Typography component="h2" id={headingId} sx={{ fontWeight: 700, flex: 1 }}>{title}</Typography>
      <Typography aria-live="polite" sx={{ whiteSpace: 'nowrap' }}>{index + 1} / {images.length}</Typography>
      <IconButton aria-label="Đóng ảnh" onClick={onClose} sx={controlStyle}><X /></IconButton>
    </Stack>
    <Box onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {images.length > 1 && <IconButton aria-label="Ảnh trước" onClick={() => move(-1)} sx={{ ...controlStyle, position: 'absolute', left: 0, zIndex: 1 }}><ChevronLeft /></IconButton>}
      {images[index] && <LightboxImage key={`${index}:${images[index]}`} src={images[index]} alt={`${title} - ảnh ${index + 1}`} />}
      {images.length > 1 && <IconButton aria-label="Ảnh tiếp theo" onClick={() => move(1)} sx={{ ...controlStyle, position: 'absolute', right: 0, zIndex: 1 }}><ChevronRight /></IconButton>}
    </Box>
    {images.length > 1 && <Stack direction="row" role="group" aria-label="Chọn ảnh" sx={{ gap: 1, overflowX: 'auto', maxWidth: '100%', mx: 'auto', py: 1, px: 0.5, flexShrink: 0 }}>
      {images.map((src, itemIndex) => <ButtonBase key={`${itemIndex}:${src}`} onClick={() => onIndexChange(itemIndex)}
        aria-label={`Xem ảnh ${itemIndex + 1}`} aria-pressed={index === itemIndex}
        sx={{ width: 64, height: 48, flexShrink: 0, borderRadius: 1, overflow: 'hidden', border: '2px solid', borderColor: index === itemIndex ? 'primary.main' : 'transparent', opacity: index === itemIndex ? 1 : 0.6 }}>
        <Box component="img" src={getTransformedImageUrl(src, { variant: 'thumbnail_small', width: 120 })} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </ButtonBase>)}
    </Stack>}
  </Dialog>;
}
