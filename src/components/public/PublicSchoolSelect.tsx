import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { publicSchoolLabel } from '../../features/schools/schoolPresentation';
import { usePublicSchoolOptionsQuery, usePublicSchoolsPageQuery } from '../../features/schools/api/school.queries';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PublicAutocomplete } from './PublicAutocomplete';
import { SchoolDataAttribution } from './SchoolDataAttribution';

const MORE = '__load_more_schools__';

export function PublicSchoolSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [typed, setTyped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const search = useDebouncedValue(typed || '', 300);
  const catalog = usePublicSchoolOptionsQuery(search);
  const selectedQuery = usePublicSchoolsPageQuery({ id: value, pageSize: 1 }, value !== 'all');
  const schools = catalog.data?.pages.flatMap(page => page.items) || [];
  const selected = schools.find(school => school.id === value)
    || selectedQuery.data?.items.find(school => school.id === value);
  const selectedLabel = value === 'all' ? 'Tất cả trường học' : selected ? publicSchoolLabel(selected) : 'Trường đã chọn';
  const missing = value !== 'all' && !selected && selectedQuery.isSuccess && !selectedQuery.isPlaceholderData;
  const error = catalog.isError || (value !== 'all' && selectedQuery.isError);
  const options = [
    { value: 'all', label: 'Tất cả trường học' },
    ...(value !== 'all' ? [{ value, label: selectedLabel }] : []),
    ...schools.filter(school => school.id !== value).map(school => ({ value: school.id, label: publicSchoolLabel(school) })),
    ...(catalog.hasNextPage ? [{ value: MORE, label: catalog.isFetchingNextPage ? 'Đang tải thêm…' : 'Xem thêm trường học' }] : []),
  ];

  return <Box sx={{ minWidth: 0 }}>
    <PublicAutocomplete label="Gần trường ĐH / Học viện" value={value} options={options}
      inputValue={typed ?? selectedLabel} open={open} onOpen={() => setOpen(true)} onClose={() => { setOpen(false); setTyped(null); }}
      onInputChange={(_, text, reason) => {
        // Selection/blur resets must not become remote searches for the displayed label.
        if (reason === 'input' || reason === 'clear') setTyped(text);
      }}
      onChange={id => {
        if (id === MORE) {
          if (!catalog.isFetching) void catalog.fetchNextPage();
          return;
        }
        onChange(id);
        setTyped(null);
        setOpen(false);
      }}
      disableCloseOnSelect filterOptions={items => items}
      getOptionDisabled={option => option.value === MORE && catalog.isFetching}
      loading={catalog.isPending} error={error || missing}
    />
    <SchoolDataAttribution />
    {catalog.isPending && <Typography role="status" variant="caption">Đang tải trường học…</Typography>}
    {error ? <Box role="alert" sx={{ fontSize: 14, mt: 0.5 }}>
      Chưa tải được danh sách trường.
      <Button size="small" disabled={catalog.isFetching || selectedQuery.isFetching} onClick={() => {
        void catalog.refetch();
        if (value !== 'all') void selectedQuery.refetch();
      }}>Thử lại</Button>
    </Box> : missing ? <Typography role="status" variant="caption" color="error">
      Trường trong liên kết không còn khả dụng. Vui lòng chọn lại hoặc bỏ lọc.
    </Typography> : catalog.isSuccess && schools.length === 0 && <Typography role="status" variant="caption">
      {search ? 'Không tìm thấy trường phù hợp.' : 'Chưa có trường học khả dụng.'}
    </Typography>}
  </Box>;
}
