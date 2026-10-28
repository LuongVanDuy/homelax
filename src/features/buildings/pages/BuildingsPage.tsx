import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Avatar, Box, Button, Checkbox, Divider, InputAdornment, LinearProgress, MenuItem, Paper, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Archive, ArchiveRestore, Building2, ExternalLink, Eye, MapPin, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { routeHref } from '../../../app/router/routePaths';
import { designTokens } from '../../../app/theme/tokens';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { AppIdentity } from '../../auth/identityStore';
import { isCmsAdministrator } from '../../cms/navigation';
import { useArchiveBuildingMutation, useBuildingsPageQuery, useBuildingStatsQuery, useDeleteBuildingMutation, useRestoreBuildingMutation } from '../api';
import { buildingErrorMessage, formatPriceRange, hasBuildingLocation } from '../buildingPresentation';
import type { BuildingRecord } from '../building.types';
import { BuildingDetailsDialog } from '../components/BuildingDetailsDialog';
import { BuildingPermissionsDialog } from '../components/BuildingPermissionsDialog';

type Action = { buildings: BuildingRecord[]; kind: 'archive' | 'restore' | 'delete' };

const actionLabels = {
  archive: { title: 'Lưu trữ', done: 'Đã lưu trữ' },
  restore: { title: 'Khôi phục', done: 'Đã khôi phục' },
  delete: { title: 'Xóa vĩnh viễn', done: 'Đã xóa' },
} as const;

function buildingNames(buildings: BuildingRecord[]) {
  const names = buildings.slice(0, 5).map((building) => `“${building.code}”`).join(', ');
  return buildings.length > 5 ? `${names} và ${buildings.length - 5} tòa khác` : names;
}

function BuildingStatus({ building }: { building: BuildingRecord }) {
  return <Chip size="small" variant="outlined" color={building.status === 'archived' ? 'warning' : 'success'}
    label={building.status === 'archived' ? 'Đã lưu trữ' : 'Đang hoạt động'} />;
}

export function BuildingsPage({ currentUser }: { currentUser: AppIdentity }) {
  const navigate = useNavigate();
  const admin = isCmsAdministrator(currentUser);
  const archiveMutation = useArchiveBuildingMutation();
  const restoreMutation = useRestoreBuildingMutation();
  const deleteMutation = useDeleteBuildingMutation();
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sort, setSort] = useState('updated-desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [details, setDetails] = useState<BuildingRecord | null>(null);
  const [permissions, setPermissions] = useState<BuildingRecord[] | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [selected, setSelected] = useState<BuildingRecord[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 350);
  const sortParams = sort === 'code'
    ? { sort: 'code' as const, order: 'asc' as const }
    : sort === 'vacant-desc'
      ? { sort: 'vacantRoomsCount' as const, order: 'desc' as const }
      : sort === 'price-asc'
        ? { sort: 'minPrice' as const, order: 'asc' as const }
        : { sort: 'updatedAt' as const, order: 'desc' as const };
  const buildingsQuery = useBuildingsPageQuery({
    scope: 'cms',
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    status: statusFilter,
    ownerType: ownerFilter as '' | 'tiny' | 'partner',
    location: locationFilter as '' | 'located' | 'missing',
    ...sortParams,
  });
  const statsQuery = useBuildingStatsQuery();
  const buildings = (buildingsQuery.data?.items || []) as BuildingRecord[];
  const totalBuildings = buildingsQuery.data?.pagination.total || 0;
  const stats = statsQuery.data;
  const busy = bulkRunning || archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending;
  const isSelected = (building: BuildingRecord) => selected.some((item) => item.id === building.id);
  const toggleSelected = (building: BuildingRecord) => setSelected((items) => isSelected(building)
    ? items.filter((item) => item.id !== building.id) : [...items, building]);
  const pageSelected = buildings.length > 0 && buildings.every(isSelected);
  const togglePage = () => setSelected((items) => pageSelected
    ? items.filter((item) => !buildings.some((building) => building.id === item.id))
    : [...items, ...buildings.filter((building) => !items.some((item) => item.id === building.id))]);

  const activeCount = stats?.active || 0;
  const archivedCount = stats?.archived || 0;
  const partnerCount = stats?.partner || 0;
  const missingLocationCount = stats?.missingCoordinates || 0;
  const visible = buildings;
  const refresh = () => {
    void buildingsQuery.refetch();
    void statsQuery.refetch();
  };

  const openRooms = (building: BuildingRecord) => {
    const buildingKey = building.code || building.id;
    navigate(`/cms/rooms?building=${encodeURIComponent(buildingKey)}`);
  };

  const confirmAction = async () => {
    if (!action || busy) return;
    const mutation = action.kind === 'archive' ? archiveMutation : action.kind === 'restore' ? restoreMutation : deleteMutation;
    setBulkRunning(true);
    const results = await Promise.allSettled(action.buildings.map((building) => mutation.mutateAsync(building.id)));
    setBulkRunning(false);
    const failed = action.buildings.filter((_, index) => results[index].status === 'rejected');
    const succeeded = action.buildings.length - failed.length;
    setSelected((items) => items.filter((item) => !action.buildings.some((building) => building.id === item.id) || failed.includes(item)));
    if (succeeded) toast.success(`${actionLabels[action.kind].done} ${succeeded} tòa nhà.`);
    if (failed.length) {
      const reason = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason;
      toast.error(`${failed.length} tòa chưa xử lý được (${buildingNames(failed)}): ${buildingErrorMessage(reason)}`);
    }
    setAction(null);
  };

  const renderActions = (building: BuildingRecord) => <CmsRowActions disabled={busy} actions={[
 {id:'view',label:'Xem chi tiết',icon:<Eye />,onClick:()=>setDetails(building)},
 {id:'edit',label:'Chỉnh sửa',icon:<Pencil />,onClick:()=>navigate('/cms/buildings/'+encodeURIComponent(building.id)+'/edit')},
 {id:'rooms',label:'Xem phòng',icon:<Building2 />,onClick:()=>openRooms(building)},
 {id:'public',label:'Xem trên website',icon:<ExternalLink />,href:routeHref.building(building.code||building.id),external:true,hidden:building.status==='archived'},
 {id:'permissions',label:'Phân quyền xem',icon:<ShieldCheck />,hidden:!admin,onClick:()=>setPermissions([building])},
 {id:'archive',label:building.status==='archived'?'Khôi phục':'Lưu trữ',icon:building.status==='archived'?<ArchiveRestore />:<Archive />,onClick:()=>setAction({buildings:[building],kind:building.status==='archived'?'restore':'archive'})},
 {id:'delete',label:'Xóa vĩnh viễn',icon:<Trash2 />,danger:true,hidden:!admin,onClick:()=>setAction({buildings:[building],kind:'delete'})},
]} />;

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Quản lý tòa nhà </>} description={<> Thông tin tòa, vị trí bản đồ, chủ nhà và album ảnh tĩnh. </>} actions={<><Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate('/cms/buildings/new')}>Thêm tòa nhà</Button></>} />

    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
      {[
        ['Đang hoạt động', activeCount, 'success.main'],
        ['Tòa đối tác', partnerCount, 'info.main'],
        ['Chưa có tọa độ', missingLocationCount, 'warning.main'],
        ['Đã lưu trữ', archivedCount, 'text.secondary'],
      ].map(([label, value, color]) => <Paper key={String(label)} variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 800, color }}>{value}</Typography>
      </Paper>)}
    </Box>

    {buildingsQuery.isError && <ErrorState title="Không tải được tòa nhà" description="Vui lòng kiểm tra kết nối và thử lại."
      action={<Button color="inherit" onClick={refresh}>Thử lại</Button>} />}

    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>{buildingsQuery.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>
      <CmsFilterBar>
        <CmsFilterField label="Tìm tòa nhà" placeholder="Tên, mã tòa, địa chỉ, chủ nhà…" value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }} />
        <CmsFilterField label="Trạng thái" select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as '' | 'active' | 'archived'); setPage(0); }}>
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="active">Đang hoạt động ({activeCount})</MenuItem>
          <MenuItem value="archived">Lưu trữ ({archivedCount})</MenuItem>
        </CmsFilterField>
        <CmsFilterField label="Loại hình" select value={ownerFilter} onChange={(event) => { setOwnerFilter(event.target.value); setPage(0); }}>
          <MenuItem value="">Tất cả</MenuItem><MenuItem value="tiny">Homelax</MenuItem><MenuItem value="partner">Đối tác</MenuItem>
        </CmsFilterField>
        <CmsFilterField label="Vị trí" select value={locationFilter} onChange={(event) => { setLocationFilter(event.target.value); setPage(0); }}>
          <MenuItem value="">Tất cả</MenuItem><MenuItem value="located">Đã có tọa độ</MenuItem><MenuItem value="missing">Chưa có tọa độ</MenuItem>
        </CmsFilterField>
        <CmsFilterField label="Sắp xếp" select value={sort} onChange={(event) => setSort(event.target.value)}>
          <MenuItem value="updated-desc">Cập nhật mới nhất</MenuItem><MenuItem value="vacant-desc">Phòng trống nhiều nhất</MenuItem><MenuItem value="price-asc">Giá thấp đến cao</MenuItem><MenuItem value="code">Mã tòa A–Z</MenuItem>
        </CmsFilterField>
      </CmsFilterBar>

      {selected.length > 0 && <Stack direction="row" useFlexGap sx={{ px: 2, py: 1.25, gap: 1, alignItems: 'center', flexWrap: 'wrap', bgcolor: 'action.selected', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, mr: 1 }}>Đã chọn {selected.length} tòa</Typography>
        {admin && <Button size="small" variant="outlined" startIcon={<ShieldCheck size={16} />} disabled={busy} onClick={() => setPermissions(selected)}>Phân quyền</Button>}
        {selected.some((building) => building.status !== 'archived') && <Button size="small" variant="outlined" startIcon={<Archive size={16} />} disabled={busy}
          onClick={() => setAction({ buildings: selected.filter((building) => building.status !== 'archived'), kind: 'archive' })}>Lưu trữ</Button>}
        {selected.some((building) => building.status === 'archived') && <Button size="small" variant="outlined" startIcon={<ArchiveRestore size={16} />} disabled={busy}
          onClick={() => setAction({ buildings: selected.filter((building) => building.status === 'archived'), kind: 'restore' })}>Khôi phục</Button>}
        {admin && <Button size="small" variant="outlined" color="error" startIcon={<Trash2 size={16} />} disabled={busy} onClick={() => setAction({ buildings: selected, kind: 'delete' })}>Xóa vĩnh viễn</Button>}
        <Button size="small" color="inherit" startIcon={<X size={16} />} disabled={busy} onClick={() => setSelected([])} sx={{ ml: 'auto' }}>Bỏ chọn</Button>
      </Stack>}

      {buildingsQuery.isPending ? <LoadingState label="Đang tải tòa nhà…" minHeight={280} /> : !visible.length ? <EmptyState
        icon={<Building2 size={36} />} title={totalBuildings ? 'Không tìm thấy tòa nhà' : 'Chưa có tòa nhà'}
        description={totalBuildings ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Tạo tòa nhà đầu tiên để bắt đầu quản lý inventory.'}
        action={totalBuildings
          ? <Button onClick={() => { setSearch(''); setStatusFilter('active'); setOwnerFilter(''); setLocationFilter(''); setPage(0); }}>Xóa bộ lọc</Button>
          : <Button onClick={() => navigate('/cms/buildings/new')}>Thêm tòa nhà</Button>} /> : <>
        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
          <Table><TableHead><TableRow>
            <TableCell padding="checkbox"><Checkbox checked={pageSelected} indeterminate={!pageSelected && buildings.some(isSelected)} onChange={togglePage}
              slotProps={{ input: { 'aria-label': 'Chọn tất cả tòa trên trang' } }} /></TableCell>
            <TableCell>Tòa nhà</TableCell><TableCell>Địa chỉ</TableCell><TableCell>Loại hình</TableCell><TableCell>Phòng / giá</TableCell><TableCell>Vị trí</TableCell><TableCell>Trạng thái</TableCell><CmsActionsCell>Thao tác</CmsActionsCell>
          </TableRow></TableHead><TableBody>
            {visible.map((building) => <TableRow
              key={building.id}
              hover
              tabIndex={0}
              role="button"
              onClick={() => navigate(`/cms/buildings/${encodeURIComponent(building.id)}/edit`)}
              onKeyDown={(event) => {
                if (!['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                navigate(`/cms/buildings/${encodeURIComponent(building.id)}/edit`);
              }}
              selected={isSelected(building)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <Checkbox checked={isSelected(building)} onChange={() => toggleSelected(building)} slotProps={{ input: { 'aria-label': `Chọn tòa ${building.code}` } }} />
              </TableCell>
              <TableCell><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Avatar variant="rounded" src={building.coverImage || building.images[0] || undefined} sx={{ width: 48, height: 48, bgcolor: designTokens.colors.brand[100] }}><Building2 size={20} /></Avatar>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{building.code}</Typography>
              </Stack></TableCell>
              <TableCell><Typography variant="body2">{building.address}</Typography><Typography variant="caption" color="text.secondary">{building.ward || '-'}</Typography></TableCell>
              <TableCell><Chip size="small" variant="outlined" label={building.ownerType === 'tiny' ? 'Homelax' : 'Đối tác'} color={building.ownerType === 'tiny' ? 'primary' : 'default'} /></TableCell>
              <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{building.vacantRoomsCount} phòng trống</Typography><Typography variant="caption" color="text.secondary">{formatPriceRange(building)}</Typography></TableCell>
              <TableCell><Chip size="small" variant="outlined" icon={<MapPin size={13} />} color={hasBuildingLocation(building) ? 'success' : 'warning'} label={hasBuildingLocation(building) ? 'Đã định vị' : 'Chưa có tọa độ'} /></TableCell>
              <TableCell><BuildingStatus building={building} /></TableCell>
              <CmsActionsCell>{renderActions(building)}</CmsActionsCell>
            </TableRow>)}
          </TableBody></Table>
        </TableContainer>
        <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {visible.map((building) => <Box key={building.id} sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'start' }}>
              <Checkbox checked={isSelected(building)} onChange={() => toggleSelected(building)} sx={{ ml: -1, mt: 0.5 }} slotProps={{ input: { 'aria-label': `Chọn tòa ${building.code}` } }} />
              <Avatar variant="rounded" src={building.coverImage || building.images[0] || undefined} sx={{ width: 52, height: 52 }}><Building2 size={20} /></Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontWeight: 800 }}>{building.code}</Typography><Typography variant="body2" color="text.secondary">{building.address}</Typography></Box>
              {renderActions(building)}
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap' }}>
              <Chip size="small" label={building.ownerType === 'tiny' ? 'Homelax' : 'Đối tác'} />
              <BuildingStatus building={building} />
              <Chip size="small" variant="outlined" label={`${building.vacantRoomsCount} phòng trống`} />
            </Stack>
          </Box>)}
        </Stack>
      </>}

      {buildingsQuery.data && <TablePagination component="div" count={totalBuildings} page={page} rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Số dòng:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        sx={{ borderTop: 1, borderColor: 'divider', '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'end', pl: 2 }, '& .MuiTablePagination-spacer': { display: 'none' } }} />}
    </CmsListCard>

    

    {details && <BuildingDetailsDialog
      building={details}
      onClose={() => setDetails(null)}
      onEdit={() => {
        navigate(`/cms/buildings/${encodeURIComponent(details.id)}/edit`);
        setDetails(null);
      }}
    />}
    {permissions && admin && <BuildingPermissionsDialog buildings={permissions} onClose={() => setPermissions(null)}
      // Selected rows hold viewer lists from before this save; reselect from fresh data.
      onSaved={() => setSelected([])} />}
    <ConfirmDialog open={Boolean(action)} loading={busy} onClose={() => setAction(null)} onConfirm={confirmAction}
      title={action ? `${actionLabels[action.kind].title} ${action.buildings.length > 1 ? `${action.buildings.length} tòa nhà` : 'tòa nhà'}?` : ''}
      description={action ? action.kind === 'delete'
        ? `Xóa ${buildingNames(action.buildings)}? API sẽ chặn tòa còn phòng hoặc lịch xem. Thao tác xóa thành công không thể hoàn tác.`
        : action.kind === 'restore' ? `Khôi phục ${buildingNames(action.buildings)} về trạng thái hoạt động?`
          : `Lưu trữ ${buildingNames(action.buildings)}? Tòa sẽ ẩn khỏi luồng public nhưng giữ dữ liệu.` : ''}
      confirmLabel={action ? actionLabels[action.kind].title : ''}
      danger={action?.kind === 'delete'} />
  </Stack>;
}
