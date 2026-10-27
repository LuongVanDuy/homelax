import type { Ref } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { PublicAutocomplete } from '../../../components/public/PublicAutocomplete';
import { useHanoiWards } from '../useHanoiWards';

export function HanoiWardSelect({ value, onChange, label = 'Khu vực', allLabel = 'Tất cả phường / xã',
  disabled, error, helperText, onBlur, inputRef, compact = false }: {
  value: string; onChange: (value: string) => void; label?: string; allLabel?: string;
  disabled?: boolean; error?: boolean; helperText?: string; onBlur?: () => void; inputRef?: Ref<HTMLInputElement>;
  compact?: boolean;
}) {
  const query = useHanoiWards();
  const wards = query.data || [];
  const selected = value && value !== 'all';
  const unknown = selected && !wards.some(ward => ward.name === value);
  const options = [
    { value: 'all', label: allLabel, group: '' },
    ...(unknown ? [{ value, label: value, group: '' }] : []),
    ...wards.map(ward => ({ value: ward.name, label: ward.name, group: ward.group })),
  ];
  return <Box sx={{ minWidth: 0 }}>
    <PublicAutocomplete label={label} value={value || 'all'} options={options} onChange={onChange}
      disabled={disabled} error={error} onBlur={onBlur} inputRef={inputRef} compact={compact}
      loading={query.isPending} loadingText="Đang tải phường / xã…" />
    {helperText && <Typography sx={{ fontSize: 14 }} color="error">{helperText}</Typography>}
    {query.isPending && <Typography sx={{ fontSize: 14 }} role="status">Đang tải phường / xã…</Typography>}
    {query.isError ? <Box role="alert" sx={{ fontSize: 14, mt: 0.5 }}>
      Chưa tải được phường/xã Hà Nội.
      <Button size="small" disabled={disabled || query.isFetching} onClick={() => void query.refetch()}>Thử lại</Button>
    </Box> : unknown && query.isSuccess && <Typography role="status" sx={{ fontSize: 14 }} color="text.secondary">
      Khu vực đã lưu chưa khớp danh mục hiện tại. Vui lòng chọn lại phường/xã.
    </Typography>}
  </Box>;
}
