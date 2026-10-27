import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Collapse, Link, Stack, Typography } from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PublicAutocomplete } from '../../../components/public/PublicAutocomplete';
import { fetchHanoiLegacyDistricts, fetchHanoiLegacyWards, fetchHanoiWardMapping, type CurrentWard } from '../hanoiLegacyAreas';

const cacheOptions = { staleTime: 24 * 60 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000, retry: 1 };

export function HanoiLegacyMappingResults({ wards, selectedWard, onSelect }: {
  wards: CurrentWard[]; selectedWard: string; onSelect: (ward: string) => void;
}) {
  if (!wards.length) return <Typography role="status" sx={{ fontSize: 14 }}>
    Chưa có ánh xạ cho địa bàn này. Bạn có thể chọn trực tiếp phường/xã hiện nay ở ô Khu vực.
  </Typography>;
  return <Stack sx={{ gap: 1 }}>
    <Typography role="status" sx={{ fontSize: 14 }}>
      {wards.length > 1 ? `Địa bàn cũ được chia vào ${wards.length} phường/xã hiện nay. Chọn khu vực bạn muốn tìm:`
        : 'Phường/xã hiện nay tương ứng. Chọn để áp dụng bộ lọc:'}
    </Typography>
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
      {wards.map(ward => <Button key={ward.code} variant={selectedWard === ward.name ? 'contained' : 'outlined'}
        aria-pressed={selectedWard === ward.name} onClick={() => onSelect(ward.name)}
        sx={{ minHeight: 44, maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' }}>
        {ward.name}
      </Button>)}
    </Stack>
    <Typography sx={{ fontSize: 14 }} color="text.secondary">
      Kết quả tìm theo toàn bộ phường/xã hiện nay đã chọn; phạm vi có thể rộng hơn địa bàn cũ.
    </Typography>
  </Stack>;
}

export function HanoiLegacyAreaLookup({ selectedWard, onSelect }: { selectedWard: string; onSelect: (ward: string) => void }) {
  const [open, setOpen] = useState(false);
  const [district, setDistrict] = useState('all');
  const [ward, setWard] = useState('all');
  const districts = useQuery({ ...cacheOptions,
    queryKey: ['locations', 'hanoi', 'legacy-districts', 'v1'],
    queryFn: ({ signal }) => fetchHanoiLegacyDistricts(signal), enabled: open,
  });
  const districtValid = Boolean(districts.data?.some(item => String(item.code) === district));
  const wards = useQuery({ ...cacheOptions,
    queryKey: ['locations', 'hanoi', 'legacy-wards', 'v1', district],
    queryFn: ({ signal }) => fetchHanoiLegacyWards(Number(district), signal), enabled: open && districtValid,
  });
  const wardValid = districtValid && Boolean(wards.data?.some(item => String(item.code) === ward));
  const mapping = useQuery({ ...cacheOptions,
    queryKey: ['locations', 'hanoi', 'ward-mapping', 'v2', district, ward],
    queryFn: ({ signal }) => fetchHanoiWardMapping(Number(ward), signal), enabled: open && wardValid,
  });
  const errorQuery = districts.isError ? districts : districtValid && wards.isError ? wards : wardValid && mapping.isError ? mapping : null;

  return <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
    <Button onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="legacy-area-lookup"
      endIcon={open ? <ChevronUp size={18} /> : <ChevronDown size={18} />} sx={{ minHeight: 44, textAlign: 'left' }}>
      Tra cứu theo địa bàn cũ
    </Button>
    <Collapse in={open}>
      <Stack id="legacy-area-lookup" sx={{ gap: 1.5, pt: 1 }}>
        <Typography sx={{ fontSize: 14 }} color="text.secondary">
          Chọn địa bàn Hà Nội trước tháng 7/2025 để tìm phường/xã hiện nay. Bộ lọc chỉ đổi khi bạn chọn kết quả bên dưới.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          <PublicAutocomplete label="Quận / huyện cũ" value={district}
            options={(districts.data || []).map(item => ({ value: String(item.code), label: item.name }))}
            loading={districts.isFetching} loadingText="Đang tải quận / huyện cũ…"
            onChange={value => { setDistrict(value); setWard('all'); }} />
          <PublicAutocomplete label="Phường / xã cũ" value={ward} disabled={!districtValid}
            options={(districtValid ? wards.data || [] : []).map(item => ({ value: String(item.code), label: item.name }))}
            loading={wards.isFetching} loadingText="Đang tải phường / xã cũ…" onChange={setWard} />
        </Box>
        {(districts.isFetching || (districtValid && wards.isFetching) || (wardValid && mapping.isFetching)) && <Typography role="status" sx={{ fontSize: 14 }}>Đang tra cứu địa bàn…</Typography>}
        {errorQuery && <Box role="alert">
          <Typography sx={{ fontSize: 14 }}>Chưa tra cứu được địa bàn cũ. Bộ lọc hiện tại vẫn được giữ.</Typography>
          <Button disabled={errorQuery.isFetching} onClick={() => void errorQuery.refetch()}>Thử lại</Button>
        </Box>}
        {wardValid && mapping.isSuccess && <HanoiLegacyMappingResults wards={mapping.data} selectedWard={selectedWard} onSelect={onSelect} />}
        <Typography sx={{ fontSize: 13 }} color="text.secondary">
          Nguồn: <Link href="https://provinces.open-api.vn/" target="_blank" rel="noopener noreferrer">Province Open API</Link>.
        </Typography>
      </Stack>
    </Collapse>
  </Box>;
}
