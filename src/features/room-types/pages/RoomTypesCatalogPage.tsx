import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { RoomTypeCatalog } from '@tinyhouse/contracts';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/feedback';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { toast } from '../../../lib/toast';
import { useArchiveRoomTypeCatalogMutation, useDeleteRoomTypeCatalogMutation, useRestoreRoomTypeCatalogMutation, useRoomTypeCatalogPageQuery, useSaveRoomTypeCatalogMutation } from '../api';

type EditorState = { item?: RoomTypeCatalog } | null;
type ConfirmState = { item: RoomTypeCatalog; action: 'archive' | 'restore' | 'delete' } | null;

export function RoomTypesCatalogPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'archived'>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  
  const debounced = useDebouncedValue(search, 300);
  const query = useRoomTypeCatalogPageQuery({
    page: page + 1, pageSize, search: debounced, status,
    sort: 'sortOrder', order: 'asc',
  });
  const save = useSaveRoomTypeCatalogMutation();
  const archive = useArchiveRoomTypeCatalogMutation();
  const restore = useRestoreRoomTypeCatalogMutation();
  const remove = useDeleteRoomTypeCatalogMutation();

  const busy = save.isPending || archive.isPending || restore.isPending || remove.isPending;
  const data = query.data;

  const perform = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'archive') await archive.mutateAsync(confirm.item.id);
      if (confirm.action === 'restore') await restore.mutateAsync(confirm.item.id);
      if (confirm.action === 'delete') await remove.mutateAsync(confirm.item.id);
      toast.success(confirm.action === 'archive' ? 'Đã lưu trữ loại phòng.'
        : confirm.action === 'restore' ? 'Đã khôi phục loại phòng.' : 'Đã xóa loại phòng.');
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý loại phòng.');
    }
  };

  const renderActions = (item: RoomTypeCatalog) => <CmsRowActions disabled={busy} actions={[
 {id:'edit',label:'Chỉnh sửa',icon:<Pencil />,onClick:()=>setEditor({item})},
 {id:'archive',label:item.status==='active'?'Lưu trữ':'Khôi phục',icon:item.status==='active'?<Archive />:<ArchiveRestore />,onClick:()=>setConfirm({item,action:item.status==='active'?'archive':'restore'})},
 {id:'delete',label:'Xóa loại phòng',icon:<Trash2 />,danger:true,disabled:item.assignmentCount>0,disabledReason:item.assignmentCount>0?'Loại phòng đang được sử dụng':undefined,onClick:()=>setConfirm({item,action:'delete'})},
]} />;

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Loại phòng </>} description={<> Quản lý danh mục loại phòng dùng chung. </>} actions={<><Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setEditor({})}>Thêm loại phòng</Button></>} />

    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', minWidth: 0 }}>
      <Box sx={{ height: 3 }}>{query.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>
      <CmsFilterBar>
        <CmsFilterField label="Tìm loại phòng" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Tên hoặc mã loại phòng"
          sx={{ minWidth: 0 }} slotProps={{ inputLabel: { shrink: true }, input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }} />
        <CmsFilterField select label="Trạng thái" value={status} onChange={event => { setStatus(event.target.value as '' | 'active' | 'archived'); setPage(0); }}
          sx={{ minWidth: 0 }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="">Tất cả trạng thái</MenuItem>
          <MenuItem value="active">Đang dùng</MenuItem>
          <MenuItem value="archived">Đã lưu trữ</MenuItem>
        </CmsFilterField>
      </CmsFilterBar>

      {query.isPending ? <LoadingState label="Đang tải loại phòng…" />
        : query.isError ? <ErrorState title="Chưa tải được loại phòng" action={<Button size="small" onClick={() => void query.refetch()}>Thử lại</Button>} />
        : <>
          <TableContainer>
            <Table sx={{ minWidth: 640 }} aria-label="Danh sách loại phòng">
              <TableHead><TableRow>
                <TableCell>Tên loại phòng</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Lượt sử dụng</TableCell><TableCell align="right">Thứ tự</TableCell><CmsActionsCell>Thao tác</CmsActionsCell>
              </TableRow></TableHead>
              <TableBody>{data?.items.map(item => <TableRow key={item.id} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{item.name}</Typography><Typography variant="caption" color="text.secondary">{item.code}</Typography></TableCell>
                <TableCell><Chip size="small" label={item.status === 'active' ? 'Đang dùng' : 'Đã lưu trữ'} color={item.status === 'active' ? 'success' : 'secondary'} /></TableCell>
                <TableCell align="right">{item.assignmentCount}</TableCell>
                <TableCell align="right">{item.sortOrder}</TableCell>
                <CmsActionsCell>
                  {renderActions(item)}
                </CmsActionsCell>
              </TableRow>)}</TableBody>
            </Table>
          </TableContainer>
          {!data?.items.length && <EmptyState title="Chưa có loại phòng phù hợp" description="Thêm loại phòng mới hoặc thay đổi bộ lọc." />}
          <TablePagination component="div" count={data?.pagination.total || 0} page={page} rowsPerPage={pageSize}
            onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={event => { setPageSize(Number(event.target.value)); setPage(0); }}
            rowsPerPageOptions={[10,20,50]} labelRowsPerPage="Số dòng" labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`} />
        </>}
    </CmsListCard>

    

    {editor && <RoomTypeCatalogEditor key={editor?.item?.id || "new"} item={editor?.item} loading={save.isPending} onClose={() => setEditor(null)}
      onSave={async values => {
        try {
          await save.mutateAsync({ id: editor?.item?.id, data: values });
          toast.success(editor?.item ? 'Đã cập nhật loại phòng.' : 'Đã thêm loại phòng.');
          setEditor(null);
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Không thể lưu loại phòng.'); }
      }} />}
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.action === 'delete' ? 'Xóa loại phòng?' : confirm?.action === 'archive' ? 'Lưu trữ loại phòng?' : 'Khôi phục loại phòng?'}
      description={confirm?.action === 'delete' ? 'Chỉ loại phòng chưa được Room Type nào sử dụng mới có thể xóa.' : 'Các Room Type hiện có vẫn giữ liên kết; mục lưu trữ không xuất hiện trong lựa chọn mới hoặc bộ lọc public.'}
      danger={confirm?.action === 'delete'} loading={busy} onClose={() => setConfirm(null)} onConfirm={perform} />
  </Stack>;
}

function RoomTypeCatalogEditor({ item, loading, onClose, onSave }: {
  item?: RoomTypeCatalog; loading: boolean; onClose: () => void;
  onSave: (data: { name: string; sortOrder: number }) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name || '');
  const [sortOrder, setSortOrder] = useState(item?.sortOrder || 0);
  return <Dialog open onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>{item ? 'Sửa loại phòng' : 'Thêm loại phòng'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <TextField autoFocus label="Tên loại phòng" value={name} onChange={event => setName(event.target.value)} required />
      <TextField label="Thứ tự" type="number" value={sortOrder} onChange={event => setSortOrder(Number(event.target.value))} slotProps={{ htmlInput: { min: 0, step: 1 } }} />
      {item?.source === 'legacy_migration' && <Typography variant="body2" color="warning.main">Đây là nhãn legacy được giữ lại để bảo toàn dữ liệu cũ.</Typography>}
    </Stack></DialogContent>
    <DialogActions><Button color="inherit" onClick={onClose} disabled={loading}>Hủy</Button>
      <Button variant="contained" disabled={loading || !name.trim()} onClick={() => void onSave({ name: name.trim(), sortOrder })}>{loading ? 'Đang lưu…' : 'Lưu'}</Button>
    </DialogActions>
  </Dialog>;
}
