import { FormControl, MenuItem, Pagination, Select, Stack, Typography } from '@mui/material';

const PAGE_SIZES = [6, 12, 21, 42] as const;

export function SearchPagination({ totalItems, itemsPerPage, currentPage, onPageChange, onItemsPerPageChange }: {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (pageSize: number) => void;
}) {
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const start = (page - 1) * itemsPerPage + 1;
  const end = Math.min(page * itemsPerPage, totalItems);

  return <Stack direction={{ xs: 'column', sm: 'row' }} sx={{
    gap: { xs: 1.25, sm: 2 }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between',
    pt: 1.5, borderTop: '1px solid', borderColor: 'divider',
  }}>
    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        Hiển thị <strong>{start.toLocaleString('vi-VN')}–{end.toLocaleString('vi-VN')}</strong> / {totalItems.toLocaleString('vi-VN')} tòa nhà
      </Typography>
      <Stack direction="row" sx={{ gap: .75, alignItems: 'center' }}>
        <Typography component="label" htmlFor="search-page-size" sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>Mỗi trang</Typography>
        <FormControl size="small" sx={{ width: 68, flexShrink: 0 }}>
          <Select id="search-page-size" value={itemsPerPage} onChange={event => onItemsPerPageChange(Number(event.target.value))}
            inputProps={{ 'aria-label': 'Số tòa nhà mỗi trang' }}
            sx={{ height: 34, fontSize: 13, '& .MuiSelect-select': { py: .5, px: 1.25 } }}>
            {PAGE_SIZES.map(size => <MenuItem key={size} value={size}>{size}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
    </Stack>

    <Pagination page={page} count={totalPages} onChange={(_, next) => onPageChange(next)}
      size="small" siblingCount={1} boundaryCount={1}
      getItemAriaLabel={(type, item) => type === 'page' ? `Trang ${item}`
        : type === 'previous' ? 'Trang trước' : type === 'next' ? 'Trang sau'
        : type === 'first' ? 'Trang đầu' : 'Trang cuối'}
      aria-label="Điều hướng trang kết quả"
      sx={{
        alignSelf: { xs: 'center', sm: 'auto' },
        '& .MuiPagination-ul': { flexWrap: 'nowrap' },
        '& .MuiPaginationItem-root': { minWidth: 32, height: 32, m: '0 2px', borderRadius: 1.5, fontSize: 13 },
        '& .MuiPaginationItem-root.Mui-selected': { fontWeight: 700 },
      }} />
  </Stack>;
}
