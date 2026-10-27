import { useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, IconButton, MenuItem, Paper, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowDown, ArrowUp, ImagePlus, Link, Plus, Trash2, View,
} from 'lucide-react';
import {
  media360ListSchema,
  type Media360Item,
  type Media360Kind,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';

const MAX_MEDIA = 20;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

type Props = {
  value: Media360Item[];
  disabled?: boolean;
  onChange: (value: Media360Item[]) => void;
  label?: string;
};

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `M360-${crypto.randomUUID()}`;
  }
  return `M360-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(items: Media360Item[]) {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh 360.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function assertEquirectangularPanorama(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = bitmap.width / bitmap.height;
    if (!bitmap.width || !bitmap.height || Math.abs(ratio - 2) > 0.1) {
      throw new Error(
        `Ảnh toàn cảnh 360° cần định dạng equirectangular tỷ lệ gần 2:1. Ảnh này là ${bitmap.width}×${bitmap.height}.`,
      );
    }
  } finally {
    bitmap.close();
  }
}

export function Media360Field({
  value,
  disabled,
  onChange,
  label = 'Media 360°',
}: Props) {
  const [kind, setKind] = useState<Media360Kind>('panorama_image');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const commit = (items: Media360Item[]) => {
    const next = normalize(items);
    onChange(next);
    const parsed = media360ListSchema.safeParse(next);
    setError(
      parsed.success
        ? ''
        : parsed.error.issues[0]?.message || 'Media 360° không hợp lệ.',
    );
  };

  const addUrl = () => {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Vui lòng nhập URL media 360°.');
      return;
    }
    if (value.length >= MAX_MEDIA) {
      setError(`Tối đa ${MAX_MEDIA} media 360°.`);
      return;
    }
    const next = normalize([
      ...value,
      {
        id: newId(),
        kind,
        url: cleanUrl,
        title: title.trim(),
        sortOrder: value.length,
      },
    ]);
    const parsed = media360ListSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Media 360° không hợp lệ.');
      return;
    }
    onChange(parsed.data);
    setError('');
    setUrl('');
    setTitle('');
  };

  const upload = async (files: FileList | null) => {
    const file = Array.from(files || [])[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Chỉ hỗ trợ tệp ảnh cho toàn cảnh 360°.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Ảnh 360° vượt quá giới hạn 12 MB.');
      return;
    }
    if (value.length >= MAX_MEDIA) {
      setError(`Tối đa ${MAX_MEDIA} media 360°.`);
      return;
    }

    setUploading(true);
    setError('');
    try {
      await assertEquirectangularPanorama(file);
      const image = await readFileAsDataUrl(file);
      const response = await ApiClient.post('/v2/upload', {
        image,
        fileName: file.name,
      }) as { url?: string };
      if (!response?.url) throw new Error('Máy chủ không trả về URL ảnh.');
      commit([
        ...value,
        {
          id: newId(),
          kind: 'panorama_image',
          url: response.url,
          title: file.name.replace(/\.[^.]+$/, ''),
          sortOrder: value.length,
        },
      ]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Không thể tải ảnh 360°.',
      );
    } finally {
      setUploading(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= value.length) return;
    const next = [...value];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    commit(next);
  };

  const update = (index: number, patch: Partial<Media360Item>) => {
    commit(value.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ));
  };

  return <Stack spacing={1.5}>
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 800 }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary">
        Ảnh toàn cảnh được lưu riêng với album ảnh tĩnh và phải là equirectangular gần 2:1. liên kết tour 360° không được nhúng tùy ý trên public.
      </Typography>
    </Box>

    {error && <Alert severity="error">{error}</Alert>}

    <Paper variant="outlined" sx={{ p: 1.5, borderStyle: 'dashed' }}>
      <Stack spacing={1.25}>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '180px minmax(0, 1fr)' } }}>
          <TextField
            select
            label="Loại media"
            value={kind}
            onChange={(event) => setKind(event.target.value as Media360Kind)}
            disabled={disabled}
          >
            <MenuItem value="panorama_image">Ảnh toàn cảnh 360°</MenuItem>
            <MenuItem value="tour_url">liên kết tour 360°</MenuItem>
          </TextField>
          <TextField
            label="Tên hiển thị"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={disabled}
            placeholder="Ví dụ: Sảnh tầng 1"
          />
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth
            label={kind === 'panorama_image' ? 'URL ảnh toàn cảnh' : 'URL tour 360°'}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={disabled}
            placeholder="https://..."
          />
          <Button
            variant="contained"
            startIcon={<Plus size={17} />}
            onClick={addUrl}
            disabled={disabled}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Thêm URL
          </Button>
        </Stack>
        <Button
          component="label"
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <ImagePlus size={17} />}
          disabled={disabled || uploading}
          sx={{ alignSelf: 'flex-start' }}
        >
          {uploading ? 'Đang tải ảnh 360°…' : 'Tải ảnh toàn cảnh'}
          <input
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => {
              void upload(event.target.files);
              event.target.value = '';
            }}
          />
        </Button>
      </Stack>
    </Paper>

    {!value.length ? (
      <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center' }}>
        <View size={28} />
        <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 700 }}>
          Chưa có media 360°
        </Typography>
      </Paper>
    ) : (
      <Stack spacing={1}>
        {value.map((item, index) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
              <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 1.5, bgcolor: 'action.hover', flexShrink: 0 }}>
                {item.kind === 'panorama_image' ? <View size={18} /> : <Link size={18} />}
              </Box>
              <TextField
                select
                label="Loại"
                value={item.kind}
                disabled={disabled}
                onChange={(event) => update(index, { kind: event.target.value as Media360Kind })}
                sx={{ minWidth: { md: 170 } }}
              >
                <MenuItem value="panorama_image">Ảnh toàn cảnh</MenuItem>
                <MenuItem value="tour_url">Link tour</MenuItem>
              </TextField>
              <TextField
                label="Tên"
                value={item.title}
                disabled={disabled}
                onChange={(event) => update(index, { title: event.target.value })}
                sx={{ minWidth: { md: 180 } }}
              />
              <TextField
                label="URL"
                value={item.url}
                disabled={disabled}
                onChange={(event) => update(index, { url: event.target.value })}
                fullWidth
              />
              <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                <Tooltip title="Lên">
                  <span><IconButton disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={17} /></IconButton></span>
                </Tooltip>
                <Tooltip title="Xuống">
                  <span><IconButton disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17} /></IconButton></span>
                </Tooltip>
                <Tooltip title="Xóa">
                  <span><IconButton color="error" disabled={disabled} onClick={() => commit(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={17} /></IconButton></span>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    )}
  </Stack>;
}
