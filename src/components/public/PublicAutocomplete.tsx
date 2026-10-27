import type { Ref } from 'react';
import { Autocomplete, TextField, type AutocompleteProps } from '@mui/material';
import { designTokens as tokens } from '../../app/theme/tokens';
import { filterPublicOptions, type PublicOption } from './public-options';

type RemoteProps = Pick<AutocompleteProps<PublicOption, false, false, false>,
  'inputValue' | 'onInputChange' | 'loading' | 'loadingText' | 'noOptionsText' | 'open' | 'onOpen' | 'onClose' | 'filterOptions' | 'getOptionDisabled' | 'disableCloseOnSelect' | 'disabled' | 'onBlur'>;

export function PublicAutocomplete({ label, value, options, onChange, error, inputRef, compact = false, ...remoteProps }: RemoteProps & {
  label: string; value: string; options: PublicOption[]; onChange: (value: string) => void;
  error?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  compact?: boolean;
}) {
  const controlHeight = compact ? 36 : 44;
  return <Autocomplete options={options} value={options.find((item) => item.value === value) ?? null}
    filterOptions={filterPublicOptions}
    groupBy={options.some((item) => item.group) ? (item) => item.group || '' : undefined} getOptionLabel={(item) => item.label}
    isOptionEqualToValue={(option, selected) => option.value === selected.value}
    onChange={(_, selected) => onChange(selected?.value || 'all')}
    openText="Mở danh sách" closeText="Đóng danh sách" clearText="Xóa lựa chọn" noOptionsText="Không có kết quả phù hợp"
    slotProps={{
      popupIndicator: { sx: { width: controlHeight, height: controlHeight, m: 0 } },
      clearIndicator: { sx: { width: controlHeight, height: controlHeight, m: 0 } },
      paper: { sx: { my: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)' } },
      listbox: { sx: { p: 0.5, maxHeight: 'min(320px, 50vh)',
        '& .MuiAutocomplete-option': { minHeight: 44, px: 1.5, py: 1, borderRadius: 1, fontSize: '0.9375rem', overflowWrap: 'anywhere',
          '&.Mui-focused': { backgroundColor: tokens.colors.neutral[100] },
          '&[aria-selected="true"], &[aria-selected="true"].Mui-focused': { backgroundColor: tokens.colors.neutral[50], color: 'primary.main' },
        },
      } },
    }}
    sx={{ minWidth: 0, '& .MuiOutlinedInput-root:not(.MuiInputBase-multiline)': {
      height: controlHeight, minHeight: controlHeight, py: 0, pl: '6px', pr: `${controlHeight}px`, '& .MuiAutocomplete-input': { height: 22, minHeight: 22, py: 0, fontSize: compact ? '.875rem' : '1rem' },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
    },
    '&.MuiAutocomplete-hasClearIcon .MuiOutlinedInput-root:not(.MuiInputBase-multiline)': { pr: `${controlHeight * 2}px` },
    // Keep MUI's 50% vertical anchor with its translate(-50%) transform.
    '& .MuiOutlinedInput-root .MuiAutocomplete-endAdornment': { right: 0, top: '50%', height: controlHeight, display: 'flex', alignItems: 'center' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' } }}
    loadingText="Đang tải trường học…"
    {...remoteProps}
    renderInput={(params) => <TextField {...params} inputRef={inputRef} label={label} error={error} variant="outlined" size="small" />} />;
}
