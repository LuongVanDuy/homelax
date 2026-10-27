import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useReducer, useState } from 'react';
import type { AuditSummary } from '@tinyhouse/contracts';
import { Avatar, Box, Button, Divider, IconButton, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Clock, Eye, History, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/feedback';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { AppIdentity } from '../../auth/identityStore';
import { getCmsNavigation } from '../../cms/navigation';
import { useAuditLogsPageQuery } from '../api';
import { auditAction, auditActions, auditActor, auditEntities, auditEntity, auditErrorMessage, auditTableReducer, auditTimestamp, initialAuditTableState, type AuditTableAction } from '../auditPresentation';
import { AuditLogDetailsDialog } from '../components/AuditLogDetailsDialog';

function ActionChip({ action }: { action: string }) {
  const presentation = auditAction(action);
  const Icon = action === 'CREATE' ? Plus : action === 'UPDATE' ? Pencil : action === 'DELETE' ? Trash2 : History;
  return <Chip size="small" variant="outlined" color={presentation.color} label={presentation.label}
    icon={<Icon size={14} aria-hidden="true" />} sx={{ maxWidth: '100%' }} />;
}
function Actor({ log }: { log: AuditSummary }) {
  const name = auditActor(log);
  return <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
    <Avatar sx={{ width: 34, height: 34, fontSize: 14, bgcolor: 'action.hover', color: 'text.secondary' }}>
      {Array.from(name)[0]?.toUpperCase()}
    </Avatar>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{name}</Typography>
      {log.userEmail && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {log.userEmail}
      </Typography>}
    </Box>
  </Stack>;
}
function EventTime({ value }: { value: string | null }) {
  const timestamp = auditTimestamp(value);
  return <Typography component="time" dateTime={timestamp.iso} variant="body2" sx={{ whiteSpace: 'nowrap' }}>
    {timestamp.date}
    {timestamp.time && <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {timestamp.time}
    </Typography>}
  </Typography>;
}
const summaryStyle = {
  overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical', overflow: 'hidden',
} as const;

export function AuditLogPage({ currentUser }: { currentUser: AppIdentity }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [state, dispatch] = useReducer(auditTableReducer, initialAuditTableState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const search = useDebouncedValue(state.search.trim(), 350);
  const waitingForSearch = state.search.trim() !== search;
  const allowed = getCmsNavigation(currentUser).some((item) => item.code === 'auditlog');
  const query = useAuditLogsPageQuery({ ...state, search, sort: 'createdAt' }, allowed && !waitingForSearch);
  const busy = waitingForSearch || query.isFetching;
  const loading = waitingForSearch || query.isPending;
  const data = query.data;
  const items = data?.items || [];
  const total = data?.pagination.total;
  const outOfRange = Boolean(data && state.page > Math.max(1, data.pagination.totalPages));
  const hasFilters = Boolean(state.search || state.action || state.entityType);
  const selected = !loading && !query.isError ? items.find((item) => item.id === selectedId) : undefined;
  const update = (action: AuditTableAction) => { setSelectedId(null); dispatch(action); };
  if (!allowed) return <ErrorState title="Không có quyền truy cập" description="Tài khoản không có quyền xem nhật ký hoạt động." />;

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Nhật ký hoạt động </>} description={<> Lịch sử thao tác được ghi nhận trên hệ thống. </>} />

    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', minWidth: 0 }} aria-busy={busy}>
      <Box sx={{ height: 3 }}>{busy && <LinearProgress aria-label="Đang tải nhật ký" />}</Box>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={1.5}>
        <CmsFilterBar inset>
          <CmsFilterField fullWidth label="Tìm kiếm" value={state.search}
            placeholder="Tên, email, nội dung hoặc mã đối tượng"
            onChange={(event) => update({ type: 'filter', value: { search: event.target.value } })}
            slotProps={{ htmlInput: { maxLength: 200 }, input: {
              startAdornment: <InputAdornment position="start"><Search size={17} aria-hidden="true" /></InputAdornment>,
              endAdornment: state.search ? <InputAdornment position="end">
                <IconButton size="small" aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => update({ type: 'filter', value: { search: '' } })}><X size={16} /></IconButton>
              </InputAdornment> : undefined,
            } }} />
          <CmsFilterField select label="Thao tác" value={state.action}
            onChange={(event) => update({ type: 'filter', value: { action: event.target.value } })}>
            <MenuItem value="">Tất cả thao tác</MenuItem>
            {auditActions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </CmsFilterField>
          <CmsFilterField select label="Đối tượng" value={state.entityType}
            onChange={(event) => update({ type: 'filter', value: { entityType: event.target.value } })}>
            <MenuItem value="">Tất cả đối tượng</MenuItem>
            {auditEntities.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </CmsFilterField>
          <CmsFilterField select label="Sắp xếp" value={state.order}
            onChange={(event) => update({ type: 'filter', value: { order: event.target.value === 'asc' ? 'asc' : 'desc' } })}>
            <MenuItem value="desc">Mới nhất</MenuItem>
            <MenuItem value="asc">Cũ nhất</MenuItem>
          </CmsFilterField>
        </CmsFilterBar>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {!query.isError && data && !waitingForSearch && <>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{total?.toLocaleString('vi-VN')} bản ghi</Typography>
            <Chip size="small" variant="outlined" icon={<Clock size={14} aria-hidden="true" />}
              label={`Lưu trữ ${data.retentionDays} ngày`} />
          </>}
          <Typography variant="caption" color="text.secondary">Thời gian hiển thị: UTC+7</Typography>
          {hasFilters && <Button size="small" onClick={() => update({ type: 'reset' })} sx={{ ml: 'auto', minHeight: 36 }}>
            Xóa bộ lọc
          </Button>}
        </Stack>
        </Stack>
      </Box>
      <Divider />
      {loading ? <LoadingState label="Đang tải nhật ký hoạt động…" /> : query.isError ? <Box sx={{ p: 2 }}>
        <ErrorState title="Không thể tải nhật ký" description={auditErrorMessage(query.error)}
          action={<Button color="inherit" onClick={() => void query.refetch()} disabled={busy}>Thử lại</Button>} />
      </Box> : outOfRange ? <EmptyState icon={<History size={32} />} title="Trang này không còn bản ghi"
        description="Danh sách đã thay đổi. Quay về trang đầu để xem nhật ký hiện tại."
        action={<Button variant="outlined" onClick={() => update({ type: 'page', value: 1 })}>Về trang đầu</Button>} />
      : items.length === 0 ? <EmptyState icon={<History size={32} />}
        title={hasFilters ? 'Không có nhật ký phù hợp' : 'Chưa có nhật ký hoạt động'}
        description={hasFilters ? 'Thử thay đổi từ khóa hoặc bỏ bộ lọc.' : 'Các hoạt động được hệ thống ghi nhận sẽ xuất hiện tại đây.'}
        action={hasFilters ? <Button onClick={() => update({ type: 'reset' })}>Xóa bộ lọc</Button> : undefined} />
      : mobile ? <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
        {items.map((log) => <Stack key={log.id} spacing={1.5} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Actor log={log} /><ActionChip action={log.action} />
          </Stack>
          <Typography variant="body2" sx={summaryStyle}>{log.summary || 'Không có mô tả.'}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {auditEntity(log.entityType)}{log.entityId ? ` · ${log.entityId}` : ''}
          </Typography>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <EventTime value={log.createdAt} />
            <Button startIcon={<Eye size={16} />} onClick={() => setSelectedId(log.id)}
              aria-label={`Xem chi tiết nhật ký ${log.id}`} sx={{ minHeight: 44 }}>Chi tiết</Button>
          </Stack>
        </Stack>)}
      </Stack> : <TableContainer>
        <Table aria-label="Danh sách nhật ký hoạt động" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 135 }}>Thời gian</TableCell>
              <TableCell sx={{ width: '23%' }}>Người thực hiện</TableCell>
              <TableCell sx={{ minWidth: 140 }}>Thao tác</TableCell>
              <TableCell sx={{ width: '19%' }}>Đối tượng</TableCell>
              <TableCell>Nội dung</TableCell>
              <CmsActionsCell>Chi tiết</CmsActionsCell>
            </TableRow>
          </TableHead>
          <TableBody>{items.map((log) => <TableRow key={log.id} hover>
            <TableCell><EventTime value={log.createdAt} /></TableCell>
            <TableCell><Actor log={log} /></TableCell>
            <TableCell><ActionChip action={log.action} /></TableCell>
            <TableCell>
              <Typography variant="body2">{auditEntity(log.entityType)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{log.entityId || '-'}</Typography>
            </TableCell>
            <TableCell><Typography variant="body2" sx={summaryStyle}>{log.summary || 'Không có mô tả.'}</Typography></TableCell>
            <CmsActionsCell><CmsRowActions actions={[{id:'action-0',label:`Xem chi tiết nhật ký ${log.id}`,icon:<Eye size={18} />,onClick:() => setSelectedId(log.id)}]} /></CmsActionsCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>}
      {!loading && !query.isError && !outOfRange && data && <TablePagination component="div"
        count={data.pagination.total} page={state.page - 1} rowsPerPage={state.pageSize}
        onPageChange={(_event, page) => update({ type: 'page', value: page + 1 })}
        onRowsPerPageChange={(event) => update({ type: 'pageSize', value: Number(event.target.value) })}
        rowsPerPageOptions={[20, 50, 100]} labelRowsPerPage="Số dòng" disabled={busy}
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count.toLocaleString('vi-VN')}`}
        getItemAriaLabel={(type) => ({ first: 'Trang đầu', last: 'Trang cuối', next: 'Trang sau', previous: 'Trang trước' })[type]}
        sx={{ borderTop: 1, borderColor: 'divider', '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'flex-end', px: 1.5 }, '& .MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } } }} />}
    </CmsListCard>
    {selected && <AuditLogDetailsDialog log={selected} onClose={() => setSelectedId(null)} />}
  </Stack>;
}
