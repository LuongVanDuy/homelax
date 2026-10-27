import { CmsFilterField, CmsFilterBar, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Box, Button, Divider, InputAdornment, LinearProgress, MenuItem, Paper, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Archive, ArchiveRestore, Building2, Layers3, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import type { Amenity, AmenityCategory, AmenityScope } from '@tinyhouse/contracts';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { toast } from '../../../lib/toast';
import { useAmenitiesPageQuery, useArchiveAmenityMutation, useDeleteAmenityMutation, useRestoreAmenityMutation } from '../api';
import { AMENITY_CATEGORY_LABELS, amenityErrorMessage, categoryOptions } from '../amenityPresentation';
import { AmenityEditorDialog } from '../components/AmenityEditorDialog';

type Action = { amenity: Amenity; kind: 'archive' | 'restore' | 'delete' };
type AmenitiesPageProps = { fixedScope?: AmenityScope };

export function AmenitiesPage({ fixedScope }: AmenitiesPageProps) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [scope, setScope] = useState<AmenityScope>(fixedScope || 'room');
  const effectiveScope = fixedScope || scope;
  const [category, setCategory] = useState<AmenityCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [editor, setEditor] = useState<Amenity | 'new' | null>(null);
  
  const [action, setAction] = useState<Action | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);

  const query = useAmenitiesPageQuery({
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    scope: effectiveScope,
    category,
    status: statusFilter,
    sort: 'sortOrder',
    order: 'asc',
  });

  const archive = useArchiveAmenityMutation();
  const restore = useRestoreAmenityMutation();
  const remove = useDeleteAmenityMutation();
  const amenities = query.data?.items || [];
  const totalAmenities = query.data?.pagination.total || 0;
  const categories = categoryOptions(effectiveScope);
  const busy = archive.isPending || restore.isPending || remove.isPending;

  const selectScope = (nextScope: AmenityScope) => {
    if (fixedScope) return;
    setScope(nextScope);
    setCategory('');
    setPage(0);
  };

  const selectCategory = (nextCategory: AmenityCategory | '') => {
    setCategory(nextCategory);
    setPage(0);
  };

  const perform = async () => {
    if (!action) return;
    try {
      if (action.kind === 'archive') {
        await archive.mutateAsync(action.amenity.id);
        toast.success('Đã lưu trữ tiện ích.');
      } else if (action.kind === 'restore') {
        await restore.mutateAsync(action.amenity.id);
        toast.success('Đã khôi phục tiện ích.');
      } else {
        await remove.mutateAsync(action.amenity.id);
        toast.success('Đã xóa tiện ích.');
      }
      setAction(null);
    } catch (error) {
      toast.error(amenityErrorMessage(error));
    }
  };

  const renderActions = (amenity: Amenity) => <CmsRowActions disabled={busy} actions={[
 {id:'edit',label:'Chỉnh sửa',icon:<Pencil />,onClick:()=>setEditor(amenity)},
 {id:'archive',label:amenity.status==='archived'?'Khôi phục':'Lưu trữ',icon:amenity.status==='archived'?<ArchiveRestore />:<Archive />,onClick:()=>setAction({amenity,kind:amenity.status==='archived'?'restore':'archive'})},
 {id:'delete',label:'Xóa vĩnh viễn',icon:<Trash2 />,danger:true,onClick:()=>setAction({amenity,kind:'delete'})},
]} />;

  return <Stack spacing={3}>
    <CmsPageHeader title={fixedScope === 'building' ? 'Tiện ích tòa nhà' : fixedScope === 'room' ? 'Tiện ích phòng' : 'Quản lý tiện ích'} description={<> Quản lý danh mục tiện ích và trạng thái sử dụng. </>} actions={<><Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setEditor('new')}>
        Thêm tiện ích
      </Button></>} />

    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' }, alignItems: 'start' }}>
      <Paper variant="outlined" sx={{ display: { xs: 'none', md: 'block' }, borderRadius: 2.5, overflow: 'hidden', position: { md: 'sticky' }, top: { md: 88 } }}>
        {!fixedScope && <>
        <Box sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 1, fontWeight: 800 }}>Phạm vi</Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {([
              ['building', 'Tòa nhà', Building2],
              ['room', 'Loại phòng', Layers3],
            ] as const).map(([value, label, Icon]) => (
              <Button
                key={value}
                fullWidth
                color={effectiveScope === value ? 'primary' : 'inherit'}
                variant={effectiveScope === value ? 'contained' : 'text'}
                startIcon={<Icon size={18} />}
                onClick={() => selectScope(value)}
                sx={{ justifyContent: 'flex-start', minHeight: 42 }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Box>
        <Divider />
        </>}
        <Box sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 1, fontWeight: 800 }}>Nhóm tiện ích</Typography>
          <Stack spacing={0.35} sx={{ mt: 0.5 }}>
            <Button
              fullWidth
              color={!category ? 'primary' : 'inherit'}
              variant={!category ? 'outlined' : 'text'}
              startIcon={<Sparkles size={17} />}
              onClick={() => selectCategory('')}
              sx={{ justifyContent: 'flex-start', minHeight: 40 }}
            >
              Tất cả nhóm
            </Button>
            {categories.map((item) => (
              <Button
                key={item}
                fullWidth
                color={category === item ? 'primary' : 'inherit'}
                variant={category === item ? 'outlined' : 'text'}
                onClick={() => selectCategory(item)}
                sx={{ justifyContent: 'flex-start', minHeight: 40, textAlign: 'left' }}
              >
                {AMENITY_CATEGORY_LABELS[item]}
              </Button>
            ))}
          </Stack>
        </Box>
      </Paper>

      <CmsListCard variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', minWidth: 0 }}>
        <Box sx={{ height: 3 }}>{query.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>

        <CmsFilterBar>
          <CmsFilterField
            fullWidth
            label="Tìm tiện ích"
            placeholder="Tên tiện ích"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }}
          />
          {!fixedScope && !desktop && <CmsFilterField
            select
            label="Phạm vi"
            value={effectiveScope}
            onChange={(event) => selectScope(event.target.value as AmenityScope)}
          >
            <MenuItem value="building">Tòa nhà</MenuItem>
            <MenuItem value="room">Loại phòng</MenuItem>
          </CmsFilterField>}
          {!desktop && <CmsFilterField
            select
            label="Nhóm"
            value={category}
            onChange={(event) => selectCategory(event.target.value as AmenityCategory | '')}
          >
            <MenuItem value="">Tất cả nhóm</MenuItem>
            {categories.map((item) => <MenuItem key={item} value={item}>{AMENITY_CATEGORY_LABELS[item]}</MenuItem>)}
          </CmsFilterField>}
          <CmsFilterField
            select
            label="Trạng thái"
            value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value as '' | 'active' | 'archived'); setPage(0); }}
            sx={{ minWidth: { lg: 190 } }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="active">Đang hoạt động</MenuItem>
            <MenuItem value="archived">Lưu trữ</MenuItem>
          </CmsFilterField>
        </CmsFilterBar>

        <Divider />

        {query.isError && <ErrorState title="Không tải được tiện ích" description="Vui lòng thử lại." action={<Button onClick={() => void query.refetch()}>Thử lại</Button>} />}
        {query.isPending ? <LoadingState label="Đang tải tiện ích…" minHeight={300} /> :
          !amenities.length ? <EmptyState title="Chưa có tiện ích phù hợp" description="Thử đổi nhóm, trạng thái hoặc từ khóa tìm kiếm." /> :
          <>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Tên tiện ích</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <CmsActionsCell>Thao tác</CmsActionsCell>
                </TableRow></TableHead>
                <TableBody>
                  {amenities.map((amenity) => <TableRow
                    key={amenity.id}
                    hover
                    onClick={() => setEditor(amenity)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{amenity.name}</Typography>
                      
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={amenity.status === 'active' ? 'success' : 'default'} label={amenity.status === 'active' ? 'Đang hoạt động' : 'Lưu trữ'} />
                    </TableCell>
                    <CmsActionsCell>
                      {renderActions(amenity)}
                    </CmsActionsCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
              {amenities.map((amenity) => <Box key={amenity.id} onClick={() => setEditor(amenity)} sx={{ p: 2, cursor: 'pointer' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>{amenity.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{AMENITY_CATEGORY_LABELS[amenity.category]}</Typography>
                    {amenity.status === 'archived' && <Chip size="small" variant="outlined" label="Lưu trữ" sx={{ mt: 1 }} />}
                  </Box>
                  {renderActions(amenity)}
                </Stack>
              </Box>)}
            </Stack>
          </>}

        {query.data && <TablePagination
          component="div"
          count={totalAmenities}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Số dòng:"
          labelDisplayedRows={({ from, to, count }) => String(from) + '–' + String(to) + ' / ' + String(count)}
          onPageChange={(_, value) => setPage(value)}
          onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />}
      </CmsListCard>
    </Box>

    

    {editor && <AmenityEditorDialog
      scope={editor === 'new' ? effectiveScope : editor.scope}
      amenity={editor === 'new' ? undefined : editor}
      onClose={() => setEditor(null)}
    />}

    <ConfirmDialog
      open={Boolean(action)}
      loading={busy}
      onClose={() => setAction(null)}
      onConfirm={perform}
      title={action?.kind === 'delete' ? 'Xóa tiện ích?' : action?.kind === 'restore' ? 'Khôi phục tiện ích?' : 'Lưu trữ tiện ích?'}
      description={action ? action.kind === 'delete'
        ? 'Xóa “' + action.amenity.name + '”? Hệ thống sẽ chặn nếu tiện ích đang được gán.'
        : action.kind === 'restore'
          ? 'Khôi phục “' + action.amenity.name + '” để có thể chọn lại trong form?'
          : 'Lưu trữ “' + action.amenity.name + '”? Những nơi đang gán vẫn được giữ nguyên.' : ''}
      confirmLabel={action?.kind === 'delete' ? 'Xóa' : action?.kind === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
      danger={action?.kind === 'delete'}
    />
  </Stack>;
}
