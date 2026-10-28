import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Copy, Download, ImagePlus } from 'lucide-react';
import { publicRoomTypeSchema, type PublicRoomSearchQuery } from '@tinyhouse/contracts';
import { usePublicRoomSearchQuery } from '../../rooms/api';
import { ApiClient } from '../../../services/apiClient';
import { toast } from '../../../lib/toast';
import { PublicImage } from '../../../components/public/PublicImage';
import { canIncludeSalesRoom, collectionPages, renderSalesCollection, type SalesImageRoom } from '../salesImageCollection';

export function SalesImageCollection({ phone, name, ready, searchParams }: {
  phone: string; name: string; ready: boolean; searchParams?: Partial<PublicRoomSearchQuery>;
}) {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SalesImageRoom[]>([]);
  const [columns, setColumns] = useState(2);
  const [pageSize, setPageSize] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<{ key: string; images: string[] }>({ key: '', images: [] });
  const query = usePublicRoomSearchQuery({ search: appliedSearch, sort: 'updated', order: 'desc', ...searchParams, availability: 'available', page, pageSize: 12 });
  const key = JSON.stringify([selected.map(room => room.id), columns, pageSize, phone, name, ready, searchParams]);
  const latest = useRef(key);
  useLayoutEffect(() => { latest.current = key; return () => { latest.current = ''; }; }, [key]);
  const currentOutput = ready && output.key === key ? output.images : [];
  const toggle = (room: SalesImageRoom) => {
    setSelected(items => items.some(item => item.id === room.id) ? items.filter(item => item.id !== room.id) : items.length < 24 ? [...items, room] : items);
  };
  const generate = async () => {
    if (!ready || !phone || !selected.length || busy) return;
    setBusy(true); setError(''); setOutput({ key: '', images: [] });
    try {
      // Re-read each selected stable ID before export; never reuse stock/price from another list page.
      const rooms = await Promise.all(selected.map(async room => publicRoomTypeSchema.parse(await ApiClient.get(`/v2/rooms/${encodeURIComponent(room.id)}?scope=public`, { bypassCache: true }))));
      if (rooms.some(room => !canIncludeSalesRoom(room))) throw new Error('Có phòng vừa hết chỗ hoặc ngừng nhận khách. Hãy bỏ chọn và kiểm tra lại danh sách.');
      const images: string[] = [];
      for (const [index, items] of collectionPages(rooms, pageSize).entries()) {
        if (latest.current !== key) return;
        const canvas = await renderSalesCollection(items, pageSize === 1 ? 1 : columns, [name, phone].filter(Boolean).join(' · '), index * pageSize);
        images.push(canvas.toDataURL('image/png'));
        // Safari caps total canvas memory; release each canvas so repeated exports keep working.
        canvas.width = 0; canvas.height = 0;
      }
      if (latest.current === key) setOutput({ key, images });
    } catch (err) { if (latest.current === key) setError(err instanceof Error ? err.message : 'Không thể tạo ảnh.'); }
    finally { setBusy(false); }
  };
  const download = (src: string, index: number) => {
    if (latest.current !== output.key || !ready) return;
    const link = document.createElement('a'); link.href = src; link.download = `homelax-danh-sach-${index + 1}.png`; link.click();
  };
  const copy = async (src: string) => {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error();
      const blob = await (await fetch(src)).blob();
      if (latest.current !== output.key || !ready) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Đã sao chép ảnh. Bạn có thể dán vào cuộc trò chuyện.');
    } catch { toast.error('Trình duyệt chưa cho sao chép ảnh. Hãy dùng Tải PNG.'); }
  };
  return <Stack spacing={2}>
    {!searchParams && <Box component="form" onSubmit={event => { event.preventDefault(); setAppliedSearch(search.trim()); setPage(1); }} sx={{ display: 'flex', gap: 1 }}>
      <TextField fullWidth label="Tìm tòa hoặc phòng để tạo ảnh" value={search} onChange={event => setSearch(event.target.value)} />
      <Button type="submit" variant="outlined">Tìm</Button>
    </Box>}
    {query.isError ? <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}>Chưa tải được danh sách phòng.</Alert>
      : query.isPending ? <Typography role="status">Đang tải phòng…</Typography>
      : <>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{query.data?.pagination.total || 0} loại phòng</Typography>
          <Button disabled={query.isFetching || !query.data?.items.length || selected.length >= 24} onClick={() => setSelected(items => {
            const ids = new Set(items.map(room => room.id));
            return [...items, ...(query.data?.items || []).filter(room => !ids.has(room.id))].slice(0, 24);
          })}>Chọn trang này</Button>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
          {query.data?.items.map(room => <Paper key={room.id} variant="outlined" sx={{
            p: 1, borderRadius: 2,
            borderColor: selected.some(item => item.id === room.id) ? 'primary.main' : 'divider',
            bgcolor: selected.some(item => item.id === room.id) ? 'action.selected' : 'background.paper',
          }}>
            <FormControlLabel sx={{ m: 0, width: '100%', alignItems: 'center', '& .MuiFormControlLabel-label': { minWidth: 0, flex: 1 } }}
              control={<Checkbox checked={selected.some(item => item.id === room.id)} disabled={!selected.some(item => item.id === room.id) && selected.length >= 24} onChange={() => toggle(room)} />}
              label={<Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                <Box sx={{ width: { xs: 64, sm: 72 }, flexShrink: 0, border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}><PublicImage src={room.coverImage || room.images[0]} alt="" aspectRatio="1" /></Box>
                <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{room.buildingCode} · {room.type}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{room.price ? `${room.price.toLocaleString('vi-VN')} đ/tháng` : 'Liên hệ giá thuê'}</Typography>
                  <Typography variant="caption" color="text.secondary">{room.vacantCount} căn trống</Typography>
                </Box>
              </Stack>} />
          </Paper>)}
        </Box>
        {!query.data?.items.length && <Typography>Không có phòng phù hợp.</Typography>}
        {(query.data?.pagination.totalPages || 1) > 1 && <Stack direction="row" sx={{ gap: 2, justifyContent: 'center', alignItems: 'center' }}>
          <Button disabled={page <= 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>Trước</Button>
          <Typography>Trang {page} / {Math.max(1, query.data?.pagination.totalPages || 1)}</Typography>
          <Button disabled={page >= (query.data?.pagination.totalPages || 1) || query.isFetching} onClick={() => setPage(p => p + 1)}>Tiếp</Button>
        </Stack>}
      </>}
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
        <Typography variant="body2" role="status" sx={{ fontWeight: 600 }}>Đã chọn {selected.length}/24 · {Math.ceil(selected.length / pageSize)} ảnh</Typography>
        {selected.length > 0 && <Button size="small" sx={{ flexShrink: 0 }} onClick={() => setSelected([])}>Bỏ chọn tất cả</Button>}
      </Stack>
      {selected.length > 0 && <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {selected.map(room => <Button key={room.id} size="small" variant="outlined" sx={{ maxWidth: '100%', textAlign: 'left', overflowWrap: 'anywhere' }} aria-label={`Bỏ chọn ${room.buildingCode} ${room.type}`} onClick={() => toggle(room)}>{room.buildingCode} · {room.type} ×</Button>)}
      </Stack>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) minmax(0, 1fr)', sm: 'minmax(120px, 1fr) minmax(140px, 1fr) auto' }, gap: 1.5, alignItems: 'center' }}>
        <TextField select fullWidth label="Bố cục" value={pageSize === 1 ? 1 : columns} disabled={pageSize === 1} onChange={event => setColumns(Number(event.target.value))} sx={{ minWidth: 0 }}>{(pageSize === 1 ? [1] : [2, 3, 4]).map(n => <MenuItem key={n} value={n}>{n} cột</MenuItem>)}</TextField>
        <TextField select fullWidth label="Mỗi ảnh" value={pageSize} onChange={event => setPageSize(Number(event.target.value))} sx={{ minWidth: 0 }}>{[1, 6, 8, 12].map(n => <MenuItem key={n} value={n}>{n} phòng</MenuItem>)}</TextField>
        <Button variant="contained" startIcon={<ImagePlus size={18} />} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, whiteSpace: 'nowrap', minHeight: 44, minWidth: 136, px: 2.5 }} disabled={!ready || !phone || !selected.length || busy} onClick={() => void generate()}>{busy ? 'Đang tạo…' : 'Tạo ảnh'}</Button>
      </Box>
    </Paper>
    {error && <Alert severity="error">{error}</Alert>}
    {currentOutput.map((src, index) => <Paper key={`${output.key}-${index}`} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, mb: 2 }}>Ảnh {index + 1}/{currentOutput.length}</Typography>
      <Box sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', overflow: 'hidden' }}>
        <Box component="img" src={src} alt={`Ảnh danh sách phòng ${index + 1}`} sx={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '70vh', mx: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }} />
      </Box>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button variant="outlined" startIcon={<Copy size={18} />} onClick={() => void copy(src)}>Copy ảnh</Button>
        <Button variant="contained" startIcon={<Download size={18} />} onClick={() => download(src, index)}>Tải PNG</Button>
      </Stack>
    </Paper>)}
  </Stack>;
}
