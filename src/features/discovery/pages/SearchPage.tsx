import { useRef, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, ThemeProvider, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from '@mui/material';
import { Columns2, ImagePlus, LayoutGrid, Map, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { PublicSalesImageDialog } from '../../affiliate/components/PublicSalesImageDialog';
import { salesImageSearchParams } from '../../affiliate/publicSalesImage';
import { defaultPublicSearch, selectedSchoolIds } from '../../../app/router/publicSearch';
import { PublicContainer, PublicSurface } from '../../../components/public';
import { useDiscoverySelected } from '../catalogs';
import { discoveryTheme } from '../discoveryTheme';
import { useBuildingDiscovery } from '../useBuildingDiscovery';
import { SearchBuildingResults } from '../components/SearchBuildingResults';
import { SearchFilterDialog } from '../components/SearchFilterDialog';
import { SearchPagination } from '../components/SearchPagination';
import { SearchResultMap } from '../components/SearchResultMap';
import type { SearchMapCamera } from '../mapModel';
import { ROOM_AUDIENCES } from '@tinyhouse/contracts';

type ActiveFilter = { id: string; label: string; remove: () => void };
const ownership = [
  { value: 'all', label: 'Tất cả' },
  { value: 'tiny', label: 'Tòa Homelax' },
  { value: 'partner', label: 'Tòa đối tác' },
];
const SPLIT_PANEL_HEIGHT = 620;

const views = [
  { value: 'grid', label: 'Lưới', Icon: LayoutGrid },
  { value: 'split', label: 'Chia đôi', Icon: Columns2 },
  { value: 'map', label: 'Bản đồ', Icon: Map },
];

export default function SearchPage() {
  const discovery = useBuildingDiscovery();
  const { filters, updateSearch, total, pending, query, mapQuery, mapPending, mapFilterKey } = discovery;
  const cameraRef = useRef<SearchMapCamera | null>(null);
  const displayTotal = filters.view === 'map' ? mapQuery.data?.total || 0 : total;
  const displayPending = filters.view === 'map' ? mapPending : pending;
  const displayError = filters.view === 'map' ? mapQuery.isError : query.isError;
  const [filterOpen, setFilterOpen] = useState(false);
  const [salesImageOpen, setSalesImageOpen] = useState(false);
  const salesImageParams = salesImageSearchParams(filters);
  const desktopSplit = useMediaQuery(discoveryTheme.breakpoints.up('lg'));

  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const schoolIds = selectedSchoolIds(filters);
  const schools = useDiscoverySelected('schools', schoolIds);
  const amenities = useDiscoverySelected('amenities', filters.amenityIds);
  const roomTypeCatalog = useDiscoverySelected('roomTypes', filters.roomTypeIds);
  const chips: ActiveFilter[] = [];
  if (filters.origin) chips.push({ id: 'origin', label: `${filters.origin.radiusKm ? `Trong ${filters.origin.radiusKm} km: ` : 'Quanh: '}${filters.origin.label}`, remove: () => updateSearch({ origin: null, ...(filters.sort === 'distance' ? { sort: 'smart' } : {}) }) });
  if (filters.audience) chips.push({ id: 'audience', label: ROOM_AUDIENCES.find(item => item.value === filters.audience)?.label || 'Nhóm khách', remove: () => updateSearch({ audience: '' }) });
  if (filters.nearSchool === 'any') chips.push({ id: 'near-school', label: 'Gần trường đại học', remove: () => updateSearch({ nearSchool: '' }) });
  if (filters.owner !== 'all') chips.push({ id: 'owner', label: filters.owner === 'tiny' ? 'Tòa Homelax' : 'Tòa đối tác', remove: () => updateSearch({ owner: 'all' }) });
  if (filters.availability === 'available') chips.push({ id: 'availability', label: 'Còn phòng trống', remove: () => updateSearch({ availability: 'all' }) });
  if (filters.ward !== 'all') chips.push({ id: 'ward', label: filters.ward, remove: () => updateSearch({ ward: 'all' }) });
  for (const id of schoolIds) chips.push({
    id: `school-${id}`, label: schools.data?.items.find(item => item.id === id)?.label || 'Trường đã chọn',
    remove: () => updateSearch({ schoolIds: schoolIds.filter(item => item !== id) }),
  });
  for (const id of filters.amenityIds) chips.push({
    id: `amenity-${id}`, label: amenities.data?.items.find(item => item.id === id)?.label || 'Tiện ích đã chọn',
    remove: () => updateSearch({ amenityIds: filters.amenityIds.filter(item => item !== id) }),
  });
  if (filters.minPrice > 0 || filters.maxPrice < defaultPublicSearch.maxPrice) chips.push({
    id: 'price', label: `${(filters.minPrice / 1_000_000).toLocaleString('vi-VN')} – ${(filters.maxPrice / 1_000_000).toLocaleString('vi-VN')} triệu/tháng`,
    remove: () => updateSearch({ minPrice: 0, maxPrice: defaultPublicSearch.maxPrice }),
  });
  for (const id of filters.roomTypeIds) chips.push({
    id: `room-type-${id}`,
    label: roomTypeCatalog.data?.items.find(item => item.id === id)?.label || 'Loại phòng đã chọn',
    remove: () => updateSearch({ roomTypeIds: filters.roomTypeIds.filter(item => item !== id) }),
  });
  if (filters.q.trim()) chips.push({ id: 'keyword', label: `Từ khóa: ${filters.q}`, remove: () => updateSearch({ q: '' }) });
  if (filters.region) chips.push({ id: 'region', label: 'Vùng bản đồ', remove: () => updateSearch({ region: null }) });
  const resetFilters = () => updateSearch({ ...defaultPublicSearch, view: filters.view, pageSize: filters.pageSize });

  return <ThemeProvider theme={discoveryTheme}>
    <PublicSurface>
      <Box data-testid="search-page" sx={{ pb: { xs: 4, md: 6 } }}>
        <Box component="section" aria-labelledby="search-title" sx={{ bgcolor: 'secondary.main', color: 'common.white', py: { xs: 3, md: 4 }, mb: 3 }}>
          <PublicContainer>
            <Typography sx={{ fontSize: 14, color: 'grey.300', mb: 1 }}>Hệ thống căn hộ Homelax & Đối tác</Typography>
            <Typography id="search-title" component="h1" sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 800, lineHeight: 1.25 }}>Tìm phòng tại Hà Nội</Typography>
            <Typography sx={{ fontSize: 16, color: 'grey.300', mt: 1 }}>Phòng trọ, căn hộ dịch vụ và studio phù hợp với bạn.</Typography>
          </PublicContainer>
        </Box>

        <PublicContainer>
          <Paper component="section" aria-label="Điều khiển tìm phòng" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2.5,
            position: 'sticky', top: { xs: 64, xl: 72 }, zIndex: 1001, bgcolor: 'background.paper', boxShadow: '0 4px 16px rgba(16,29,48,.08)' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 1.5, justifyContent: 'space-between', alignItems: { xs: 'stretch', lg: 'center' } }}>
              <ToggleButtonGroup exclusive value={filters.owner} aria-label="Loại tòa nhà"
                onChange={(_, owner: string | null) => { if (owner) updateSearch({ owner }); }}
                sx={{ alignSelf: 'flex-start', width: { xs: '100%', lg: 'auto' }, '& .MuiToggleButton-root': { flex: { xs: 1, lg: 'initial' }, px: { xs: 1, sm: 2 }, fontSize: { xs: 13, sm: 14 } } }}>
                {ownership.map(item => <ToggleButton key={item.value} value={item.value}>{item.label}</ToggleButton>)}
              </ToggleButtonGroup>
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                <ToggleButtonGroup exclusive value={filters.view} aria-label="Chế độ xem kết quả"
                  onChange={(_, view: string | null) => { if (view) updateSearch({ view }); }}>
                  {views.map(({ value, label, Icon }) => <ToggleButton key={value} value={value} aria-label={label} title={label} sx={{ gap: 1 }}>
                    <Icon size={18} aria-hidden="true" /><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{label}</Box>
                  </ToggleButton>)}
                </ToggleButtonGroup>
                <Button ref={filterButtonRef} variant="contained" startIcon={<SlidersHorizontal size={18} aria-hidden="true" />}
                  aria-label="Mở bộ lọc" aria-haspopup="dialog" aria-expanded={filterOpen}
                  aria-controls={filterOpen ? 'search-filter-dialog' : undefined} onClick={() => setFilterOpen(true)} sx={{ flexShrink: 0 }}>
                  Bộ lọc{chips.length > 0 ? ` (${chips.length})` : ''}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {chips.length > 0 && <Stack direction="row" aria-label="Bộ lọc đang áp dụng" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2.5 }}>
            {chips.map(chip => <Chip key={chip.id} label={chip.label} variant="outlined" onClick={chip.remove} onDelete={chip.remove}
              aria-label={`Bỏ lọc ${chip.label}`} deleteIcon={<X size={16} aria-hidden="true" />}
              sx={{ maxWidth: '100%', minHeight: 36, height: 'auto', fontSize: 14, fontWeight: 500, '& .MuiChip-label': { whiteSpace: 'normal', py: .75, overflowWrap: 'anywhere' } }} />)}
            <Button size="small" startIcon={<RotateCcw size={16} aria-hidden="true" />} onClick={resetFilters}>Xóa tất cả</Button>
          </Stack>}

          <Stack direction="row" sx={{ mb: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" startIcon={<ImagePlus size={18} />} aria-haspopup="dialog" onClick={() => setSalesImageOpen(true)}>Tạo ảnh gửi khách</Button>
          </Stack>
          <Box data-testid="search-results-layout" sx={{ display: 'grid', gap: 3, minWidth: 0,
            gridTemplateColumns: filters.view === 'split' ? { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } : 'minmax(0, 1fr)' }}>
            {filters.view !== 'grid' && <Box sx={{
              minWidth: 0, order: { xs: 0, lg: filters.view === 'split' ? 1 : 0 },
              ...(filters.view === 'split' && desktopSplit ? { height: SPLIT_PANEL_HEIGHT } : {}),
            }}>
              <SearchResultMap pending={mapPending} error={mapQuery.isError} data={mapQuery.data}
                onRetry={() => void mapQuery.refetch()} filterKey={mapFilterKey} region={filters.region}
                getSavedCamera={() => cameraRef.current} onCameraChange={camera => { cameraRef.current = camera; }}
                onRegionChange={region => updateSearch({ region })}
                height={filters.view === 'map' ? 660 : desktopSplit ? SPLIT_PANEL_HEIGHT : 500} />
            </Box>}
            {filters.view !== 'map' && <Box data-testid="search-results-scroll" sx={{
              minWidth: 0,
              ...(filters.view === 'split' && desktopSplit ? {
                height: SPLIT_PANEL_HEIGHT, overflowY: 'auto', pr: 1, scrollbarGutter: 'stable',
                scrollbarWidth: 'thin',
                '&::-webkit-scrollbar': { width: 6 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 999 },
              } : {}),
            }}>
              <SearchBuildingResults discovery={discovery} columns={filters.view === 'split' ? 1 : 3} />
            </Box>}
          </Box>
          {filters.view !== 'map' && !pending && !query.isError && total > 0 && <Box sx={{ mt: 3 }}>
            <SearchPagination totalItems={total} itemsPerPage={filters.pageSize} currentPage={filters.page}
              onPageChange={page => updateSearch({ page })} onItemsPerPageChange={pageSize => updateSearch({ pageSize })} />
          </Box>}
        </PublicContainer>
      </Box>
      <SearchFilterDialog open={filterOpen} onClose={() => setFilterOpen(false)} onAfterClose={() => filterButtonRef.current?.focus()} filters={filters}
        onChange={updateSearch} onReset={resetFilters} total={displayTotal} pending={displayPending} error={displayError} />
      {salesImageOpen && <PublicSalesImageDialog key={JSON.stringify(salesImageParams)} searchParams={salesImageParams} onClose={() => setSalesImageOpen(false)} />}
    </PublicSurface>
  </ThemeProvider>;
}
