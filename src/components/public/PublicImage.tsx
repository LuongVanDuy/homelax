import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ImageOff } from 'lucide-react';
import { getTransformedImageUrl } from '../../utils/imageTransformer';

export function PublicImage({ src, alt, priority = false, aspectRatio = '4 / 3', fill = false }: { src?: string; alt: string; priority?: boolean; aspectRatio?: string; fill?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = src ? getTransformedImageUrl(src, { variant: 'thumbnail' }) : '';
  return <Box sx={{ position: 'relative', aspectRatio: fill ? 'auto' : aspectRatio, width: '100%', height: fill ? '100%' : 'auto', bgcolor: 'background.default', overflow: 'hidden' }}>
    {image && failedSrc !== image ? <Box component="img" src={image} alt={alt}
      loading={priority ? 'eager' : 'lazy'} decoding="async"
      onError={() => setFailedSrc(image)}
      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      : <Box role="img" aria-label={`Chưa có ảnh: ${alt}`} sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
        <ImageOff size={28} aria-hidden="true" />
        <Typography variant="body2">Chưa có ảnh</Typography>
      </Box>}
  </Box>;
}
