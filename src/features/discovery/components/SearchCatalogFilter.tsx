import { useState } from 'react';
import { SchoolDataAttribution } from '../../../components/public/SchoolDataAttribution';
import { Autocomplete, Box, Button, Checkbox, Chip, Stack, TextField, Typography } from '@mui/material';
import type { AmenityScope } from '@tinyhouse/contracts';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { mergeCatalogOptions, useDiscoveryOptions, useDiscoverySelected, type CatalogKind, type CatalogOption } from '../catalogs';

const MORE = '__more__';
export function SearchCatalogFilter({ kind, scope, label, value, onChange }: {
  kind: CatalogKind; scope?: AmenityScope; label: string; value: string[]; onChange: (ids: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const search = useDebouncedValue(input, 300);
  const catalog = useDiscoveryOptions(kind, search, scope);
  const selectedQuery = useDiscoverySelected(kind, value);
  const selectedRows = (selectedQuery.data?.items || []).filter(item => !scope || item.scope === scope);
  const fetched = catalog.data?.pages.flatMap(page => page.items) || [];
  const selected = mergeCatalogOptions(fetched.filter(item => value.includes(item.id)), selectedRows).filter(item => value.includes(item.id));
  const options = mergeCatalogOptions(fetched, selected);
  const error = catalog.isError || (value.length > 0 && selectedQuery.isError);
  const unavailable = selectedQuery.isSuccess ? value.filter(id => !selectedQuery.data.items.some(item => item.id === id)) : [];
  const selection = kind === 'schools' ? value.map(id => selected.find(item => item.id === id) || {
    id, label: 'Trường đã chọn', description: '', group: '',
  }) : selected;
  const choices: CatalogOption[] = [...mergeCatalogOptions(options, selection), ...(catalog.hasNextPage ? [{
    id: MORE, label: catalog.isFetchingNextPage ? 'Đang tải thêm…' : 'Xem thêm', description: '', group: '',
  }] : [])];

  return <Stack sx={{ gap: .6, minWidth: 0 }}>
    <Autocomplete multiple disableCloseOnSelect options={choices} value={selection} inputValue={input}
      filterOptions={items => items} getOptionLabel={item => item.label}
      isOptionEqualToValue={(a, b) => a.id === b.id} groupBy={scope ? item => item.group : undefined}
      onInputChange={(_, next, reason) => { if (reason === 'input' || reason === 'clear') setInput(next); }}
      onClose={() => setInput('')} renderValue={() => null}
      onChange={(_, next) => {
        if (next.some(item => item.id === MORE)) {
          if (!catalog.isFetching) void catalog.fetchNextPage();
          return;
        }
        const displayedIds = new Set(selection.map(item => item.id));
        onChange([...value.filter(id => !displayedIds.has(id)), ...next.map(item => item.id)]);
      }}
      loading={catalog.isPending || input !== search} loadingText="Đang tải danh mục…"
      noOptionsText={input ? 'Không tìm thấy lựa chọn phù hợp' : 'Chưa có danh mục khả dụng'}
      openText="Mở danh sách" closeText="Đóng danh sách" clearText="Bỏ lựa chọn"
      getOptionDisabled={item => item.id === MORE && catalog.isFetching}
      renderOption={(props, item, state) => {
        const { key, ...rest } = props;
        return <li key={key} {...rest}>
          {item.id !== MORE && <Checkbox checked={state.selected} tabIndex={-1} disableRipple sx={{ pointerEvents: 'none', p: .5 }} />}
          <Box sx={{ minWidth: 0 }}><Typography sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{item.label}</Typography>
            {item.description && <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{item.description}</Typography>}
          </Box>
        </li>;
      }}
      renderInput={params => <TextField {...params} label={label} placeholder={selection.length ? `Đã chọn ${selection.length}` : 'Tìm và chọn'} error={error} />}
      slotProps={{ listbox: { sx: { maxHeight: 280, '& .MuiAutocomplete-option': { minHeight: 38, py: .5, fontSize: 14 }, '& .MuiAutocomplete-groupLabel': { fontSize: 14, fontWeight: 700, lineHeight: '30px' } } } }}
      sx={{ minWidth: 0, '& .MuiOutlinedInput-root': { height: '44px !important', minHeight: 44, flexWrap: 'nowrap', py: '0 !important' },
        '& .MuiAutocomplete-input': { minWidth: '30px !important', fontSize: 14 }, '& .MuiAutocomplete-endAdornment': { top: '50%', transform: 'translateY(-50%)' } }} />
    {kind === 'schools' && <SchoolDataAttribution />}
    {selection.length > 0 && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
      {selection.map(item => <Chip key={item.id} size="small" label={item.description ? `${item.label} · ${item.description}` : item.label}
        onDelete={() => onChange(value.filter(id => id !== item.id))}
        sx={{ maxWidth: '100%', height: 26, fontSize: 14,
          '& .MuiChip-label': { px: 1 }, '& .MuiChip-deleteIcon': { fontSize: 16 } }} />)}
    </Box>}
    {error && <Box role="alert" sx={{ fontSize: 14 }}>Chưa tải được danh mục.
      <Button disabled={catalog.isFetching || selectedQuery.isFetching} onClick={() => {
        void catalog.refetch(); if (value.length) void selectedQuery.refetch();
      }}>Thử lại</Button>
    </Box>}
    {unavailable.length > 0 && (kind === 'schools' || kind === 'roomTypes' || scope === 'building') && <Box role="status" sx={{ fontSize: 14, color: 'error.main' }}>
      {unavailable.length} {kind === 'schools' ? 'trường' : kind === 'roomTypes' ? 'loại phòng' : 'tiện ích'} đã chọn không còn khả dụng.
      <Button onClick={() => onChange(value.filter(id => !unavailable.includes(id)))}>Bỏ mục không khả dụng</Button>
    </Box>}
  </Stack>;
}
