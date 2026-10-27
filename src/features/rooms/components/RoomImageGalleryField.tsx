import { CmsBadge as Chip } from '../../../components/cms';
import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { ApiClient } from '../../../services/apiClient';
import { compressImageClientSide } from '../../../utils/imageCompressor';

const MAX_IMAGES = 25;

export function RoomImageGalleryField({
  images,
  disabled,
  onChange,
}: {
  images: string[];
  disabled?: boolean;
  onChange: (images: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const next = [...images];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  const upload = async (files: FileList | null) => {
    const selected = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (!selected.length) return;
    if (images.length + selected.length > MAX_IMAGES) {
      setError(`Tối đa ${MAX_IMAGES} ảnh cho một loại phòng.`);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of selected) {
        const { base64 } = await compressImageClientSide(file, {
          maxDimension: 1600,
          quality: 0.82,
        });
        const response = await ApiClient.post('/v2/upload', {
          image: base64,
          fileName: file.name,
        }) as { url?: string };
        if (!response?.url) throw new Error('Máy chủ không trả về URL ảnh.');
        urls.push(response.url);
      }
      onChange([...images, ...urls]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không thể tải ảnh.');
    } finally {
      setUploading(false);
    }
  };

  return <Stack spacing={1}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>Ảnh loại phòng</Typography>
        <Typography variant="caption" color="text.secondary">Tối đa {MAX_IMAGES} ảnh · ảnh đầu tiên là ảnh bìa.</Typography>
      </Box>
      <Button component="label" variant="outlined" startIcon={uploading ? <CircularProgress size={16} /> : <ImagePlus size={18} />} disabled={disabled || uploading}>
        {uploading ? 'Đang tải…' : 'Thêm ảnh'}
        <input hidden multiple accept="image/*" type="file" onChange={(event) => {
          void upload(event.target.files);
          event.target.value = '';
        }} />
      </Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {!images.length ? <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center', borderStyle: 'dashed' }}>
      <ImagePlus size={28} />
      <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 700 }}>Chưa có ảnh loại phòng</Typography>
    </Paper> : <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
      {images.map((url, index) => <Paper key={url + index} variant="outlined" sx={{ overflow: 'hidden', position: 'relative' }}>
        <Box component="img" src={url} alt="" sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', maxHeight: 120 }} />
        {index === 0 && <Chip icon={<Star size={12} />} label="Ảnh bìa" size="small" color="primary" sx={{ position: 'absolute', top: 6, left: 6 }} />}
        <Stack direction="row" spacing={0.25} sx={{ p: 0.5, justifyContent: 'center' }}>
          <Tooltip title="Sang trái"><span><IconButton size="small" disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowLeft size={16} /></IconButton></span></Tooltip>
          <Tooltip title="Sang phải"><span><IconButton size="small" disabled={disabled || index === images.length - 1} onClick={() => move(index, 1)}><ArrowRight size={16} /></IconButton></span></Tooltip>
          <Tooltip title="Đặt làm ảnh bìa"><span><IconButton size="small" disabled={disabled || index === 0} onClick={() => onChange([url, ...images.filter((_, itemIndex) => itemIndex !== index)])}><Star size={16} /></IconButton></span></Tooltip>
          <Tooltip title="Xóa ảnh"><span><IconButton size="small" color="error" disabled={disabled} onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></IconButton></span></Tooltip>
        </Stack>
      </Paper>)}
    </Box>}
  </Stack>;
}
