import { Box, Checkbox, FormControlLabel, MenuItem, Stack, TextField } from '@mui/material';
import { selectedSchoolIds, type PublicSearch } from '../../../app/router/publicSearch';
import { PublicPriceFilter } from '../../../components/public/PublicPriceFilter';
import { SearchCatalogFilter } from './SearchCatalogFilter';
import { HanoiWardSelect } from '../../locations/components/HanoiWardSelect';
import { HanoiLegacyAreaLookup } from '../../locations/components/HanoiLegacyAreaLookup';
import { discoverySortOptions } from '../searchQuery';
import { ROOM_AUDIENCES } from '@tinyhouse/contracts';
import { AddressSearch } from '../../locations/components/AddressSearch';

export function SearchBasicFilters({ filters, onChange }: {
  filters: PublicSearch; onChange: (patch: Partial<PublicSearch>, replace?: boolean) => void;
}) {
  return <Stack sx={{ gap: 1.5 }}>
    <FormControlLabel control={<Checkbox checked={filters.nearSchool === 'any'} onChange={event => onChange({ nearSchool: event.target.checked ? 'any' : '' })} />} label="Chỉ xem tòa gần trường đại học" />
    <Box data-testid="search-filter-fields" sx={{
      display: 'grid', gap: 1.5, alignItems: 'start',
      gridTemplateColumns: {
        xs: 'minmax(0, 1fr)',
        sm: 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(3, minmax(0, 1fr))',
      },
      '& .MuiInputBase-root': { minHeight: 44 },
      '& .MuiInputLabel-root': { fontSize: 14 },
      '& .MuiInputBase-input, & .MuiSelect-select': { fontSize: 14 },
    }}>
      <TextField autoFocus label="Tìm theo từ khóa" placeholder="Tên tòa, mã tòa, địa chỉ…" value={filters.q}
        slotProps={{ htmlInput: { maxLength: 200 } }} onChange={event => onChange({ q: event.target.value }, true)} />
      <TextField select label="Sắp xếp theo" value={filters.sort} onChange={event => onChange({ sort: event.target.value })}>
        {discoverySortOptions.map(option => <MenuItem key={option.value} value={option.value} disabled={option.value === 'distance' && !filters.origin} sx={{ fontSize: 14 }}>{option.label}</MenuItem>)}
      </TextField>
      <HanoiWardSelect value={filters.ward} onChange={ward => onChange({ ward })} />
      <TextField select label="Nhóm khách phù hợp" value={filters.audience} onChange={event => onChange({ audience: event.target.value })}>
        <MenuItem value="">Tất cả nhóm khách</MenuItem>
        {ROOM_AUDIENCES.map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
      </TextField>
      <SearchCatalogFilter kind="schools" label="Gần trường ĐH / Học viện" value={selectedSchoolIds(filters)} onChange={schoolIds => onChange({ schoolIds })} />
      <PublicPriceFilter minPrice={filters.minPrice} maxPrice={filters.maxPrice} onChange={range => onChange(range)} />
      <TextField select label="Tình trạng tòa nhà" value={filters.availability} onChange={event => onChange({ availability: event.target.value })}>
        <MenuItem value="all" sx={{ fontSize: 14 }}>Tất cả tình trạng</MenuItem>
        <MenuItem value="available" sx={{ fontSize: 14 }}>Còn phòng trống</MenuItem>
      </TextField>
      <SearchCatalogFilter kind="amenities" scope="building" label="Tiện ích tòa nhà" value={filters.amenityIds} onChange={amenityIds => onChange({ amenityIds })} />
      <SearchCatalogFilter kind="amenities" scope="room" label="Tiện ích phòng" value={filters.amenityIds} onChange={amenityIds => onChange({ amenityIds })} />
      <SearchCatalogFilter kind="roomTypes" label="Loại phòng" value={filters.roomTypeIds}
        onChange={roomTypeIds => onChange({ roomTypeIds })} />
    </Box>
    <AddressSearch filters={filters} onChange={onChange} />
    <HanoiLegacyAreaLookup selectedWard={filters.ward} onSelect={ward => onChange({ ward })} />
  </Stack>;
}
