import { CmsPageHeader, CmsBadge as Chip } from '../../../components/cms';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Download, Image as ImageIcon, Phone, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PublicLink } from '../../../app/router/PublicLink';
import { routeHref } from '../../../app/router/routePaths';
import { AffiliateShareButton } from '../components/AffiliateShareButton';
import { canUseCtvTools } from '../ctvTools';
import type { AppIdentity } from '../../auth/identityStore';
import { useAffiliateReferralQuery } from '../api';
import { useBuildingsQuery } from '../../buildings/api';
import { useRoomsByBuildingQuery } from '../../rooms/api';
import { getTransformedImageUrl } from '../../../utils/imageTransformer';
import { getValidImageUrl } from '../../../utils/roomHierarchy';
import { toast } from '../../../lib/toast';
import { SalesImageCollection } from '../components/SalesImageCollection';

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function uniqueImages(values: string[]) {
  return Array.from(new Set(values.map((value) => getValidImageUrl(value)).filter(Boolean)));
}

function exportSourceUrl(rawUrl: string) {
  const valid = getValidImageUrl(rawUrl);
  if (!valid) return '';
  return `/api/v2/images/transform?url=${encodeURIComponent(valid)}&w=2400&q=92&fmt=jpeg`;
}

function wrapText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadCanvasImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không tải được ảnh nguồn để xuất.'));
    image.src = url;
  });
}

export function SalesImagePage({ currentUser }: { currentUser: AppIdentity }) {
  const [mode, setMode] = useState('single');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isCtv = canUseCtvTools(currentUser);
  const referralQuery = useAffiliateReferralQuery(isCtv);
  const buildingsQuery = useBuildingsQuery('public', isCtv);

  const buildings = buildingsQuery.data || [];
  const [params, setParams] = useSearchParams();
  const buildingId = params.get('buildingId') || '';
  const roomTypeId = params.get('roomId') || '';
  const roomUnitId = params.get('unitId') || '';
  const selectData = (building: string, room = '', unit = '') => {
    const next = new URLSearchParams();
    if (building) next.set('buildingId', building);
    if (room) next.set('roomId', room);
    if (room && unit) next.set('unitId', unit);
    setParams(next, { replace: true });
  };
  const [imageUrl, setImageUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [renderNonce, setRenderNonce] = useState(0);

  const selectedBuildingId = buildingId && buildings.some((item) => item.id === buildingId)
    ? buildingId
    : buildingId ? '' : buildings[0]?.id || '';
  const building = buildings.find((item) => item.id === selectedBuildingId) || null;
  const roomsQuery = useRoomsByBuildingQuery(isCtv ? selectedBuildingId || undefined : undefined);
  const rooms = roomsQuery.data || [];

  const selectedRoomTypeId = roomTypeId
    && rooms.some((item) => item.id === roomTypeId || item.roomTypeId === roomTypeId)
    ? roomTypeId
    : '';
  const room = rooms.find((item) =>
    item.id === selectedRoomTypeId || item.roomTypeId === selectedRoomTypeId) || null;
  const roomUnits = useMemo(
    () => (room?.roomUnits || []).filter((unit) => unit.status === 'available'),
    [room],
  );

  const selectedRoomUnitId = roomUnitId && roomUnits.some((item) => item.id === roomUnitId)
    ? roomUnitId
    : '';

  const imageCandidates = useMemo(() => uniqueImages([
    ...(room ? [room.coverImage, ...(room.images || [])] : []),
    ...(building ? [building.coverImage, ...(building.images || [])] : []),
  ]), [building, room]);
  const selectedImageUrl = imageUrl && imageCandidates.includes(imageUrl)
    ? imageUrl
    : imageCandidates[0] || '';

  const unit = roomUnits.find((item) => item.id === selectedRoomUnitId) || null;
  const referral = referralQuery.data;
  const phone = String(referral?.phone || '').trim();
  const selectionInvalid = Boolean((buildingId && !building) || (roomTypeId && !room) || (roomUnitId && !unit));
  const dataError = referralQuery.isError || buildingsQuery.isError || (Boolean(selectedBuildingId) && roomsQuery.isError);
  const dataLoading = referralQuery.isPending || buildingsQuery.isPending || (Boolean(selectedBuildingId) && roomsQuery.isPending);
  const canRender = mode === 'single' && isCtv && !selectionInvalid && !dataError && !dataLoading;
  const targetHref = room ? `${routeHref.room(room.id)}${unit ? `?${new URLSearchParams({ unitId: unit.id })}` : ''}`
    : building ? routeHref.building(building.code || building.id) : '';
  const renderKey = JSON.stringify([building, room, unit, selectedImageUrl, phone, referral?.collaboratorName, renderNonce, canRender]);
  const [renderedKey, setRenderedKey] = useState('');
  const latestRenderKey = useRef(renderKey);
  useLayoutEffect(() => {
    latestRenderKey.current = renderKey;
    return () => { latestRenderKey.current = ''; };
  }, [renderKey]);


  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canRender || !canvas || !building || !selectedImageUrl || !phone) {
      setRenderedKey('');
      setRenderError('');
      if (canvas) {
        const context = canvas.getContext('2d');
        context?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const render = async () => {
      setRenderedKey('');
      setRendering(true);
      setRenderError('');
      try {
        const source = await loadCanvasImage(exportSourceUrl(selectedImageUrl));
        if (cancelled) return;

        const width = source.naturalWidth || source.width;
        const height = source.naturalHeight || source.height;
        if (!width || !height) throw new Error('Ảnh nguồn không có kích thước hợp lệ.');

        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Trình duyệt không hỗ trợ Canvas.');

        context.drawImage(source, 0, 0, width, height);

        const overlayHeight = Math.max(height * 0.34, Math.min(height * 0.48, width * 0.34));
        const overlayTop = height - overlayHeight;
        const gradient = context.createLinearGradient(0, overlayTop, 0, height);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
        gradient.addColorStop(0.28, 'rgba(15, 23, 42, 0.72)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.96)');
        context.fillStyle = gradient;
        context.fillRect(0, overlayTop, width, overlayHeight);

        const pad = Math.max(24, Math.round(width * 0.045));
        const maxTextWidth = width - pad * 2;
        const titleSize = Math.max(24, Math.round(width * 0.05));
        const bodySize = Math.max(18, Math.round(width * 0.028));
        const smallSize = Math.max(15, Math.round(width * 0.021));
        let y = Math.max(overlayTop + pad, height - overlayHeight * 0.72);

        context.textBaseline = 'top';
        context.fillStyle = '#ffffff';
        context.font = `700 ${titleSize}px Arial, sans-serif`;
        const title = building.name || building.code || 'Tòa nhà';
        for (const line of wrapText(context, title, maxTextWidth).slice(0, 2)) {
          context.fillText(line, pad, y);
          y += titleSize * 1.18;
        }

        const locationParts = [building.code, room?.type, unit?.code].filter(Boolean);
        if (locationParts.length) {
          context.font = `600 ${bodySize}px Arial, sans-serif`;
          context.fillStyle = 'rgba(255,255,255,0.95)';
          context.fillText(locationParts.join(' · '), pad, y);
          y += bodySize * 1.45;
        }

        if (room?.price) {
          context.font = `700 ${bodySize}px Arial, sans-serif`;
          context.fillStyle = '#ffffff';
          context.fillText(`${money(room.price)} / tháng`, pad, y);
          y += bodySize * 1.4;
        }

        const address = [building.address, building.ward, building.district].filter(Boolean).join(', ');
        if (address) {
          context.font = `400 ${smallSize}px Arial, sans-serif`;
          context.fillStyle = 'rgba(255,255,255,0.82)';
          for (const line of wrapText(context, address, maxTextWidth).slice(0, 2)) {
            context.fillText(line, pad, y);
            y += smallSize * 1.25;
          }
          y += smallSize * 0.25;
        }

        const contactText = [referral?.collaboratorName, phone].filter(Boolean).join(' · ');
        context.font = `700 ${bodySize}px Arial, sans-serif`;
        context.fillStyle = '#ffffff';
        context.fillText(contactText, pad, Math.min(y, height - pad - bodySize * 1.2));
        setRenderedKey(renderKey);
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : 'Không thể dựng ảnh.');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [building, phone, referral?.collaboratorName, renderNonce, room, selectedImageUrl, unit, canRender, renderKey]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canRender || renderedKey !== renderKey || !canvas || renderError || rendering || !building || !selectedImageUrl || !phone) return;
    canvas.toBlob((blob) => {
      if (latestRenderKey.current !== renderKey) return;
      if (!blob) {
        toast.error('Không thể tạo tệp ảnh.');
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const safeCode = String(building.code || building.id || 'building').replace(/[^a-zA-Z0-9_-]+/g, '-');
      const safeUnit = String(unit?.code || room?.type || '').replace(/[^a-zA-Z0-9_-]+/g, '-');
      anchor.href = objectUrl;
      anchor.download = `homelax-${safeCode}${safeUnit ? '-' + safeUnit : ''}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }, 'image/png');
  };

  const loading = dataLoading;

  if (!isCtv) return <Alert severity="warning">Công cụ này dành cho tài khoản CTV đang hoạt động.</Alert>;

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Tạo ảnh bán phòng </>} description={<> Tạo ảnh từ dữ liệu tòa/phòng đang có trên hệ thống và SĐT hồ sơ CTV của bạn. </>} />

    <ToggleButtonGroup exclusive value={mode} aria-label="Kiểu ảnh bán phòng" onChange={(_, value: string | null) => { if (value) setMode(value); }}>
      <ToggleButton value="single">Ảnh một phòng</ToggleButton><ToggleButton value="collection">Ảnh danh sách phòng</ToggleButton>
    </ToggleButtonGroup>
    {mode === 'collection' ? <>
      {referralQuery.isError && <Alert severity="error" action={<Button onClick={() => void referralQuery.refetch()}>Thử lại</Button>}>Chưa tải được hồ sơ CTV.</Alert>}
      <SalesImageCollection phone={phone} name={referral?.collaboratorName || 'CTV'} ready={isCtv && !referralQuery.isError && !referralQuery.isPending} />
    </> : <>

    {dataError && <Alert severity="error" action={<Button color="inherit" onClick={() => {
      void referralQuery.refetch(); void buildingsQuery.refetch();
      if (selectedBuildingId) void roomsQuery.refetch();
    }}>Thử lại</Button>}>Chưa tải được dữ liệu để tạo ảnh. Vui lòng thử lại.</Alert>}
    {!loading && !dataError && selectionInvalid && <Alert severity="warning">Tòa, loại phòng hoặc căn trong liên kết không còn phù hợp. Hãy chọn lại dữ liệu bên dưới trước khi tạo ảnh.</Alert>}
    {canRender && targetHref && <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
      <Button component={PublicLink} to={targetHref} variant="outlined">{room ? 'Xem phòng trên trang web' : 'Xem tòa trên trang web'}</Button>
      <AffiliateShareButton currentUser={currentUser} href={targetHref} />
    </Stack>}
    {!loading && !dataError && !phone && <Alert severity="warning">
      Hồ sơ CTV chưa có số điện thoại. Hãy cập nhật hồ sơ trước khi tạo ảnh; công cụ không cho nhập số thay thế để tránh sai danh tính.
    </Alert>}

    <Box sx={{
      display: 'grid',
      gap: 2,
      gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, 0.7fr) minmax(0, 1.3fr)' },
      alignItems: 'start',
    }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 800 }}>1. Chọn dữ liệu</Typography>
            <TextField
              select
              label="Tòa nhà"
              value={selectedBuildingId}
              onChange={(event) => {
                selectData(event.target.value);
                setImageUrl('');
              }}
              disabled={loading}
            >
              {buildings.map((item) =>
                <MenuItem key={item.id} value={item.id}>
                  {[item.code, item.name].filter(Boolean).join(' · ')}
                </MenuItem>)}
            </TextField>

            <TextField
              select
              label="Loại phòng (không bắt buộc)"
              value={selectedRoomTypeId}
              onChange={(event) => {
                selectData(selectedBuildingId, event.target.value);
                setImageUrl('');
              }}
              disabled={!selectedBuildingId || roomsQuery.isPending}
            >
              <MenuItem value="">Chỉ dùng thông tin tòa</MenuItem>
              {rooms.map((item) =>
                <MenuItem key={item.id} value={item.id}>
                  {item.type} · {money(item.price)}
                </MenuItem>)}
            </TextField>

            <TextField
              select
              label="Căn đang trống (không bắt buộc)"
              value={selectedRoomUnitId}
              onChange={(event) => selectData(selectedBuildingId, selectedRoomTypeId, event.target.value)}
              disabled={!room || roomUnits.length === 0}
              helperText={room && roomUnits.length === 0 ? 'Loại phòng này hiện không có căn trống.' : ''}
            >
              <MenuItem value="">Không ghi căn cụ thể</MenuItem>
              {roomUnits.map((item) =>
                <MenuItem key={item.id} value={item.id}>{item.code}</MenuItem>)}
            </TextField>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={1.25}>
            <Typography sx={{ fontWeight: 800 }}>2. Thông tin CTV trên ảnh</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Phone size={18} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {referral?.collaboratorName || 'CTV'}
                </Typography>
                <Typography variant="body2" color={phone ? 'text.primary' : 'warning.main'}>
                  {phone || 'Chưa có số điện thoại'}
                </Typography>
              </Box>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              SĐT lấy trực tiếp từ hồ sơ CTV đang đăng nhập và không thể sửa tại công cụ này.
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={1.25}>
            <Typography sx={{ fontWeight: 800 }}>3. Chọn ảnh nguồn</Typography>
            {roomsQuery.isPending && selectedRoomTypeId ? <CircularProgress size={24} /> : imageCandidates.length === 0
              ? <Typography variant="body2" color="text.secondary">
                  Tòa/phòng này chưa có ảnh tĩnh phù hợp.
                </Typography>
              : <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                  {imageCandidates.slice(0, 18).map((item) => <Box
                    component="button"
                    key={item}
                    type="button"
                    onClick={() => setImageUrl(item)}
                    sx={{
                      p: 0,
                      border: 2,
                      borderColor: selectedImageUrl === item ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      bgcolor: 'background.paper',
                      aspectRatio: '1 / 1',
                    }}
                  >
                    <Box
                      component="img"
                      src={getTransformedImageUrl(item, { width: 300, quality: 75 })}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </Box>)}
                </Box>}
          </Stack>
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 2 }, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Xem trước ảnh xuất</Typography>
              <Typography variant="caption" color="text.secondary">
                Tỷ lệ và kích thước theo ảnh nguồn sau tối ưu kỹ thuật.
              </Typography>
            </Box>
            <Chip
              size="small"
              icon={<ImageIcon size={14} />}
              label={room ? 'Tòa + phòng' : 'Thông tin tòa'}
              variant="outlined"
            />
          </Stack>

          {renderError && <Alert severity="error" action={<Button
            color="inherit"
            size="small"
            startIcon={<RefreshCw size={15} />}
            onClick={() => setRenderNonce((value) => value + 1)}
          >
            Thử lại
          </Button>}>
            {renderError}
          </Alert>}

          <Box sx={{
            position: 'relative',
            minHeight: 280,
            borderRadius: 2.5,
            bgcolor: 'grey.100',
            overflow: 'hidden',
            display: 'grid',
            placeItems: 'center',
          }}>
            {!selectedImageUrl ? <Typography variant="body2" color="text.secondary">
              Chọn tòa và ảnh nguồn để xem trước.
            </Typography> : <>
              <Box
                component="canvas"
                ref={canvasRef}
                sx={{
                  display: renderError ? 'none' : 'block',
                  width: '100%',
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                }}
              />
              {rendering && <Stack
                spacing={1}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                <CircularProgress size={28} />
                <Typography variant="body2">Đang dựng ảnh…</Typography>
              </Stack>}
            </>}
          </Box>

          <Button
            variant="contained"
            startIcon={<Download size={18} />}
            onClick={download}
            disabled={!canRender || renderedKey !== renderKey || !selectedImageUrl || !phone || rendering || Boolean(renderError)}
            sx={{ minHeight: 44, alignSelf: { xs: 'stretch', sm: 'flex-end' } }}
          >
            Tải ảnh PNG
          </Button>
        </Stack>
      </Paper>
    </Box>
    </>}
  </Stack>;
}
