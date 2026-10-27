import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography,
} from '@mui/material';
import { ExternalLink, View, X } from 'lucide-react';
import type { Media360Item } from '@tinyhouse/contracts';
import type { Viewer as PhotoSphereViewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function PublicMedia360({
  media,
  subject,
  inline = false,
}: { media: Media360Item[]; subject: string; inline?: boolean }) {
  const items = useMemo(
    () => [...(media || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [media],
  );
  const [selected, setSelected] = useState<Media360Item | null>(null);
  const [viewerError, setViewerError] = useState('');
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selected || selected.kind !== 'panorama_image' || !viewerElement) return;
    if (!supportsWebGL()) {
      setViewerError('Trình duyệt hoặc GPU hiện không hỗ trợ WebGL nên không thể hiển thị ảnh 360°.');
      return;
    }

    let disposed = false;
    let viewer: PhotoSphereViewer | null = null;
    let timeoutId = window.setTimeout(() => {
      if (!disposed) {
        setViewerError('Ảnh 360° tải quá lâu hoặc GPU không dựng được texture. Vui lòng đóng và thử lại.');
        viewer?.destroy();
        viewer = null;
      }
    }, 15_000);

    const clearLoadTimeout = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = 0;
      }
    };

    setViewerError('');
    void import('@photo-sphere-viewer/core')
      .then(({ Viewer, events }) => {
        if (disposed) return;
        viewer = new Viewer({
          container: viewerElement,
          caption: selected.title || subject,
          navbar: ['zoom', 'move', 'fullscreen'],
          touchmoveTwoFingers: true,
          mousewheelCtrlKey: true,
          loadingTxt: 'Đang tải ảnh 360°…',
        });
        const markLoaded = () => {
          if (disposed) return;
          clearLoadTimeout();
          viewer?.loader.hide();
        };
        viewer.addEventListener(events.PanoramaLoadedEvent.type, markLoaded, { once: true });
        viewer.addEventListener(events.ReadyEvent.type, markLoaded, { once: true });
        viewer.addEventListener(events.PanoramaErrorEvent.type, () => {
          if (!disposed) {
            clearLoadTimeout();
            viewer?.loader.hide();
            setViewerError('Không thể dựng ảnh toàn cảnh 360°. Vui lòng thử lại.');
          }
        }, { once: true });
        void viewer.setPanorama(selected.url)
          .then((loaded) => {
            if (!loaded) throw new Error('Panorama load was interrupted.');
            markLoaded();
          })
          .catch(() => {
            if (!disposed) {
              clearLoadTimeout();
              viewer?.loader.hide();
              setViewerError('Không thể mở ảnh toàn cảnh 360°. Vui lòng thử lại.');
            }
          });
      })
      .catch(() => {
        if (!disposed) {
          clearLoadTimeout();
          setViewerError('Không thể khởi tạo viewer 360°. Vui lòng thử lại.');
        }
      });

    return () => {
      disposed = true;
      clearLoadTimeout();
      viewer?.destroy();
    };
  }, [selected, subject, viewerElement]);

  if (!items.length) return null;

  const first = items.find(item => item.kind === 'panorama_image') || items[0];

  return <>
    <Box sx={{ mt: inline ? 0 : 1.5, display: 'flex', justifyContent: 'flex-end' }}>
      <Button
        variant="outlined"
        startIcon={<View size={18} aria-hidden="true" />}
        onClick={() => setSelected(first)}
        sx={{ minHeight: 40, width: 'auto', whiteSpace: 'nowrap' }}
      >
        Xem 360°
      </Button>
    </Box>

    <Dialog
      open={Boolean(selected)}
      onClose={() => setSelected(null)}
      fullWidth
      maxWidth="lg"
      slotProps={{
        paper: {
          sx: {
            m: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
            maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
            borderRadius: { xs: 2, sm: 2.5 },
          },
        },
      }}
    >
      <DialogTitle sx={{ pr: 7, py: 1.75, fontWeight: 800 }}>
        Xem 360° · {subject}
        <IconButton
          aria-label="Đóng viewer 360°"
          onClick={() => setSelected(null)}
          sx={{ position: 'absolute', right: 10, top: 8 }}
        >
          <X size={20} />
        </IconButton>
      </DialogTitle>

      {items.length > 1 && <Stack direction="row" sx={{ px: 2, pb: 1.5, gap: 1, overflowX: 'auto' }}>
        {items.map((item, index) => <Button
          key={item.id}
          size="small"
          variant={selected?.id === item.id ? 'contained' : 'outlined'}
          onClick={() => setSelected(item)}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {item.title || `Góc 360° ${index + 1}`}
        </Button>)}
      </Stack>}

      <DialogContent dividers sx={{ p: 0, bgcolor: '#0B1220', position: 'relative' }}>
        {selected?.kind === 'panorama_image' && <Box
          ref={setViewerElement}
          sx={{
            width: '100%',
            height: { xs: '60vh', sm: 620 },
            minHeight: { xs: 340, sm: 500 },
            '& .psv-loader': { display: 'none !important' },
          }}
        />}

        {selected?.kind === 'tour_url' && <Stack sx={{ minHeight: 320, p: 3, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2, bgcolor: 'background.paper' }}>
          <Typography sx={{ fontWeight: 800 }}>{selected.title || 'Tour 360° bên ngoài'}</Typography>
          <Typography sx={{ maxWidth: 560, color: 'text.secondary' }}>
            Tour bên ngoài không được nhúng trực tiếp vào trang web. Bạn có thể mở ở tab mới.
          </Typography>
          <Button component="a" href={selected.url} target="_blank" rel="noopener noreferrer" variant="contained" endIcon={<ExternalLink size={17} />}>
            Mở tour 360°
          </Button>
        </Stack>}

        {viewerError && <Stack role="alert" sx={{
          position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
          bgcolor: '#0B1220', color: 'common.white', p: 3, textAlign: 'center',
        }}>
          <Typography sx={{ fontWeight: 800 }}>{viewerError}</Typography>
        </Stack>}
      </DialogContent>

    </Dialog>
  </>;
}

