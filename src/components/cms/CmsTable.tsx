import { Table, TableCell, TablePagination } from '@mui/material';
import type { TableProps, TableCellProps, TablePaginationProps } from '@mui/material';

export function CmsTable({ sx, ...props }: TableProps) {
  return <Table {...props} size="small" sx={[
    { '& > thead > tr > th': { height: 48, boxSizing: 'border-box', py: 1, px: 2, fontSize: 14, fontWeight: 700, lineHeight: 1.4, verticalAlign: 'middle', whiteSpace: 'nowrap', bgcolor: 'background.default' },
      '& > tbody > tr > td': { px: 2, py: 1.5, fontSize: 14, lineHeight: 1.5, verticalAlign: 'middle' },
      '& > tbody > tr:last-child > td': { borderBottom: 0 } },
    ...(Array.isArray(sx) ? sx : [sx]),
  ]} />;
}

export function CmsActionsCell({ sx, ...props }: TableCellProps) {
  return <TableCell {...props} align="right" sx={[{ width: '1%', whiteSpace: 'nowrap' }, ...(Array.isArray(sx) ? sx : [sx])]} />;
}

export function CmsTablePagination({ sx, ...props }: TablePaginationProps) {
  return <TablePagination labelRowsPerPage="Số dòng:"
    labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
    getItemAriaLabel={(type) => ({ first: 'Trang đầu', last: 'Trang cuối', next: 'Trang tiếp theo', previous: 'Trang trước' })[type]}
    {...props} component="div" sx={[
      ...(Array.isArray(sx) ? sx : [sx]),
      { borderTop: 1, borderColor: 'divider', '& .MuiTablePagination-toolbar': { minHeight: 56, px: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }, '& .MuiTablePagination-spacer': { display: 'none' } },
    ]} />;
}
