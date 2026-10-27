import { CmsBadge as Chip, CmsTable as Table } from '../../../components/cms';
import { Alert, Box, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { PreparedRestore } from '../databaseRestoreWorkflow';
import { databaseFileSize, databaseNumber, databaseTableLabel, databaseTime } from '../databaseAdminPresentation';

export function RestorePreview({ preview }: { preview: PreparedRestore }) {
  const { file, report } = preview;
  const tables = Array.from(new Set([
    ...Object.keys(report.currentCounts), ...Object.keys(report.incomingCounts), ...report.preservedTables,
  ]));
  return <Stack spacing={2}>
    <Box>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>Kết quả kiểm tra bản sao lưu</Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{file.name} · {databaseFileSize(file.size)}</Typography>
      <Typography variant="body2" color="text.secondary">
        Bản sao lưu v{file.version} · {databaseTime(file.exportedAt)}
      </Typography>
    </Box>
    <Alert severity="info">
      {report.warning || 'Đã kiểm tra định dạng và số bản ghi; chưa thay đổi dữ liệu hiện tại.'}
    </Alert>
    <Typography variant="body2" color="text.secondary">
      Khi khôi phục, hệ thống sẽ kiểm tra lại tính hợp lệ của dữ liệu trước khi áp dụng.
    </Typography>
    <TableContainer sx={{ maxHeight: 320, border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Table size="small" stickyHeader aria-label="Đối chiếu dữ liệu trước khi khôi phục">
        <TableHead><TableRow>
          <TableCell>Bảng dữ liệu</TableCell><TableCell align="right">Hiện tại</TableCell>
          <TableCell align="right">Trong tệp</TableCell><TableCell>Xử lý</TableCell>
        </TableRow></TableHead>
        <TableBody>{tables.map((table) => {
          const preserved = report.preservedTables.includes(table);
          const incoming = report.incomingCounts[table];
          const action = table === 'refresh_tokens' ? 'Thu hồi phiên'
            : preserved ? 'Giữ nguyên'
              : incoming !== undefined ? 'Thay thế' : 'Theo quy tắc phiên bản';
          return <TableRow key={table}>
            <TableCell>
              <Typography variant="body2">{databaseTableLabel(table)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{table}</Typography>
            </TableCell>
            <TableCell align="right">{databaseNumber(report.currentCounts[table])}</TableCell>
            <TableCell align="right">{databaseNumber(incoming)}</TableCell>
            <TableCell><Chip size="small" variant="outlined" color={preserved ? 'success' : 'default'} label={action} /></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </TableContainer>
  </Stack>;
}
