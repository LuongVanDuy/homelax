import { useMemo } from 'react';
import {
  Autocomplete, Box, LinearProgress, TextField, Typography,
} from '@mui/material';
import type { Amenity, AmenityCategory, AmenityScope } from '@tinyhouse/contracts';
import { useAmenitiesPageQuery } from '../api';
import { AMENITY_CATEGORY_LABELS } from '../amenityPresentation';

const ROOM_CATEGORIES: AmenityCategory[] = [
  'room_furniture',
  'room_electrical',
  'room_other',
  'room_fire_safety',
];

const BUILDING_CATEGORIES: AmenityCategory[] = [
  'building_common',
  'building_security',
  'building_fire_safety',
  'building_other',
];

export function AmenityMultiSelect({
  scope,
  value,
  onChange,
  disabled,
}: {
  scope: AmenityScope;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const activeQuery = useAmenitiesPageQuery({
    page: 1,
    pageSize: 200,
    scope,
    status: 'active',
    sort: 'sortOrder',
    order: 'asc',
  });

  const activeIds = new Set((activeQuery.data?.items || []).map((amenity) => amenity.id));
  const missingSelectedIds = activeQuery.isSuccess
    ? value.filter((id) => !activeIds.has(id))
    : [];
  const selectedQuery = useAmenitiesPageQuery({
    page: 1,
    pageSize: Math.max(1, Math.min(200, missingSelectedIds.length || 1)),
    scope,
    status: '',
    ids: missingSelectedIds.join(','),
    sort: 'sortOrder',
    order: 'asc',
  }, activeQuery.isSuccess && missingSelectedIds.length > 0);

  const all = useMemo(() => {
    const map = new Map<string, Amenity>();
    for (const amenity of activeQuery.data?.items || []) map.set(amenity.id, amenity);
    for (const amenity of selectedQuery.data?.items || []) map.set(amenity.id, amenity);
    return [...map.values()];
  }, [activeQuery.data?.items, selectedQuery.data?.items]);

  const selectedSet = new Set(value);
  const categories = scope === 'building' ? BUILDING_CATEGORIES : ROOM_CATEGORIES;

  const updateCategory = (category: AmenityCategory, selected: Amenity[]) => {
    const categoryIds = new Set(
      all
        .filter((amenity) => amenity.category === category)
        .map((amenity) => amenity.id),
    );
    const otherIds = value.filter((id) => !categoryIds.has(id));
    onChange([...otherIds, ...selected.map((amenity) => amenity.id)]);
  };

  return <Box>
    {(activeQuery.isFetching || selectedQuery.isFetching) && (
      <LinearProgress sx={{ mb: 1.25, borderRadius: 999 }} />
    )}

    {activeQuery.isError || selectedQuery.isError ? (
      <Typography variant="body2" color="error">
        Không tải được danh mục tiện ích.
      </Typography>
    ) : (
      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          alignItems: 'start',
        }}
      >
        {categories.map((category) => {
          const options = all.filter((amenity) =>
            amenity.category === category
            && (amenity.status === 'active' || selectedSet.has(amenity.id)),
          );
          const selected = options.filter((amenity) => selectedSet.has(amenity.id));

          return <Autocomplete
            key={category}
            multiple
            disableCloseOnSelect
            filterSelectedOptions
            options={options}
            value={selected}
            disabled={disabled || activeQuery.isPending}
            getOptionLabel={(amenity) => amenity.name}
            isOptionEqualToValue={(option, selectedAmenity) => option.id === selectedAmenity.id}
            onChange={(_, next) => updateCategory(category, next)}
            noOptionsText="Không có tiện ích"
            renderOption={(props, amenity) => (
              <li {...props} key={amenity.id}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2">{amenity.name}</Typography>
                  {amenity.status === 'archived' && (
                    <Typography variant="caption" color="text.secondary">
                      Đã lưu trữ
                    </Typography>
                  )}
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={AMENITY_CATEGORY_LABELS[category]}
                placeholder={selected.length ? '' : 'Chọn tiện ích'}
              />
            )}
            slotProps={{
              listbox: {
                sx: {
                  maxHeight: 280,
                },
              },
            }}
            sx={{
              minWidth: 0,
              '& .MuiAutocomplete-inputRoot': {
                minHeight: '44px !important',
                height: 'auto !important',
                maxHeight: 'none',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                overflow: 'visible',
                columnGap: 0.75,
                rowGap: 0.75,
                pt: '10px !important',
                pb: '6px !important',
                pr: '34px !important',
              },
              '& .MuiAutocomplete-input': {
                minWidth: '72px !important',
                width: 'auto !important',
                flex: '1 1 72px !important',
                py: '2px !important',
              },
              '& .MuiChip-root': {
                height: 30,
                maxWidth: '100%',
                margin: '0 !important',
              },
            }}
          />;
        })}
      </Box>
    )}
  </Box>;
}
