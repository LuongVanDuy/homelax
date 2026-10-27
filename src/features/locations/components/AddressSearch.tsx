import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { MapPin, Search } from 'lucide-react';
import type { LocationSearchResult } from '@tinyhouse/contracts';
import type { PublicSearch } from '../../../app/router/publicSearch';
import { searchAddresses } from '../addressSearch';

export function AddressSearch({ filters, onChange }: { filters: PublicSearch; onChange: (patch: Partial<PublicSearch>) => void }) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState<LocationSearchResult['items'] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const find = async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError(''); setItems(null);
    try {
      const result = await searchAddresses(input, controller.signal);
      if (!controller.signal.aborted) setItems(result.items);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Chưa tìm được địa chỉ.');
    } finally { if (!controller.signal.aborted) setPending(false); }
  };
  return <Stack spacing={1.5} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
    <Typography sx={{ fontWeight: 700 }}>Tìm quanh địa chỉ</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField label="Địa chỉ tại Hà Nội" placeholder="Ví dụ: 144 Xuân Thủy" value={input} fullWidth
        slotProps={{ htmlInput: { maxLength: 200 } }}
        onChange={event => { request.current?.abort(); setPending(false); setInput(event.target.value); setItems(null); setError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (input.trim().length >= 3 && !pending) void find(); } }} />
      <Button variant="outlined" startIcon={<Search size={17} />} disabled={pending || input.trim().length < 3} onClick={() => void find()}
        sx={{ whiteSpace: 'nowrap', flexShrink: 0, minHeight: 44 }}>{pending ? 'Đang tìm…' : 'Tìm địa chỉ'}</Button>
    </Stack>
    {error && <Alert severity="warning">{error}</Alert>}
    {items && (items.length ? <Stack aria-label="Kết quả địa chỉ" spacing={.5}>
      {items.map(item => <Button key={item.id} variant="text" color="inherit" startIcon={<MapPin size={18} />} sx={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', minHeight: 44 }}
        onClick={() => { onChange({ origin: { lat: item.lat, lng: item.lng, label: item.label, radiusKm: filters.origin?.radiusKm ?? 5 }, sort: 'distance' }); setItems(null); setInput(''); }}>
        {item.label}
      </Button>)}
    </Stack> : <Typography role="status" color="text.secondary">Không tìm thấy địa chỉ. Thử thêm tên đường hoặc khu vực.</Typography>)}
    {filters.origin && <>
      <Chip label={filters.origin.label} onDelete={() => onChange({ origin: null, ...(filters.sort === 'distance' ? { sort: 'smart' } : {}) })}
        sx={{ alignSelf: 'flex-start', maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 1 } }} />
      <TextField select label="Khoảng cách tối đa" value={filters.origin.radiusKm ?? 'all'} onChange={event => onChange({ origin: { ...filters.origin!, radiusKm: event.target.value === 'all' ? null : Number(event.target.value) } })}>
        <MenuItem value="all">Không giới hạn khoảng cách</MenuItem>
        {[1, 3, 5, 10, 20, 50].map(km => <MenuItem key={km} value={km}>Trong {km} km</MenuItem>)}
      </TextField>
      <Typography variant="body2" color="text.secondary">Khoảng cách đường thẳng ước tính từ vị trí công khai của tòa nhà.</Typography>
    </>}
    <Box sx={{ fontSize: 12, color: 'text.secondary' }}>Địa chỉ: <Link href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" color="inherit">© OpenStreetMap contributors</Link></Box>
  </Stack>;
}
