import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Autocomplete, Avatar, Box, Button, Divider, InputAdornment, LinearProgress, MenuItem, Paper, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Archive, ArchiveRestore, DoorOpen, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { AppIdentity } from '../../auth/identityStore';
import type { RoomType } from '@tinyhouse/contracts';
import { useNavigate, useSearchParams } from 'react-router';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { updateAutocompleteSearch, useStableAutocompleteOptions } from '../../../hooks/useStableAutocompleteOptions';
import { useBuildingsPageQuery } from '../../buildings/api';
import { useArchiveRoomMutation, useDeleteRoomMutation, useRestoreRoomMutation, useRoomsPageQuery, useRoomStatsQuery } from '../api';
import { formatMoney, roomErrorMessage } from '../roomPresentation';
import { RoomDetailsDialog } from '../components/RoomDetailsDialog';

type Action = {
  room: RoomType;
  kind: 'archive' | 'restore' | 'delete';
};

export function RoomsPage({ currentUser }: { currentUser: AppIdentity }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBuilding = searchParams.get('building') || '';
  const archiveMutation = useArchiveRoomMutation();
  const restoreMutation = useRestoreRoomMutation();
  const deleteMutation = useDeleteRoomMutation();

  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [buildingCode, setBuildingCode] = useState(initialBuilding);
  const [buildingSearch, setBuildingSearch] = useState(initialBuilding);
  const [availability, setAvailability] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [details, setDetails] = useState<RoomType | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);
  const debouncedBuildingSearch = useDebouncedValue(buildingSearch, 300);
  const roomsQuery = useRoomsPageQuery({
    scope: 'cms',
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    lifecycleStatus: statusFilter,
    building: buildingCode,
    availability: availability as '' | 'available' | 'full' | 'empty',
    sort: 'updatedAt',
    order: 'desc',
  });
  const statsQuery = useRoomStatsQuery();
  const buildingsQuery = useBuildingsPageQuery({
    scope: 'cms',
    page: 1,
    pageSize: 30,
    search: debouncedBuildingSearch,
    status: 'active',
    sort: 'name',
    order: 'asc',
  });
  const rooms = roomsQuery.data?.items || [];
  const buildingAutocomplete = useStableAutocompleteOptions(
    buildingsQuery.data?.items || [],
    buildingCode ? [buildingCode] : [],
    (building) => building.code,
  );
  const buildingOptions = buildingAutocomplete.options;
  const totalRooms = roomsQuery.data?.pagination.total || 0;
  const stats = statsQuery.data;

  const hardDelete = ['admin', 'superadmin'].includes(
    String(currentUser?.roleCode || '').toLowerCase(),
  );
  const busy =
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    deleteMutation.isPending;

  const activeCount = stats?.activeTypes || 0;
  const archivedCount = stats?.archivedTypes || 0;
  const totalUnits = stats?.totalUnits || 0;
  const vacantUnits = stats?.vacantUnits || 0;
  const visible = rooms;

  const performAction = async () => {
    if (!action) return;
    try {
      if (action.kind === 'archive') {
        await archiveMutation.mutateAsync(action.room.id);
        toast.success('Đã lưu trữ loại phòng.');
      } else if (action.kind === 'restore') {
        await restoreMutation.mutateAsync(action.room.id);
        toast.success('Đã khôi phục loại phòng.');
      } else {
        await deleteMutation.mutateAsync(action.room.id);
        toast.success('Đã xóa loại phòng.');
      }
      setAction(null);
    } catch (error) {
      toast.error(roomErrorMessage(error));
    }
  };

  const renderActions = (room: RoomType) => <CmsRowActions disabled={busy} actions={[
 {id:'view',label:'Xem chi tiết',icon:<Eye />,onClick:()=>setDetails(room)},
 {id:'edit',label:'Chỉnh sửa',icon:<Pencil />,onClick:()=>navigate('/cms/rooms/'+encodeURIComponent(room.id)+'/edit')},
 {id:'archive',label:room.lifecycleStatus==='archived'?'Khôi phục':'Lưu trữ',icon:room.lifecycleStatus==='archived'?<ArchiveRestore />:<Archive />,onClick:()=>setAction({room,kind:room.lifecycleStatus==='archived'?'restore':'archive'})},
 {id:'delete',label:'Xóa vĩnh viễn',icon:<Trash2 />,danger:true,hidden:!hardDelete,onClick:()=>setAction({room,kind:'delete'})},
]} />;

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Quản lý phòng </>} description={<> Loại phòng, giá niêm yết và từng căn vật lý thực tế. </>} actions={<><Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate('/cms/rooms/new')}>
        Thêm loại phòng
      </Button></>} />

    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
      {[
        ['Loại phòng hoạt động', activeCount],
        ['Tổng căn', totalUnits],
        ['Căn đang trống', vacantUnits],
      ].map(([label, value]) => <Paper key={String(label)} variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h5" sx={{ mt: 0.25, fontWeight: 800 }}>{value}</Typography>
      </Paper>)}
    </Box>

    {roomsQuery.isError && <ErrorState title="Không tải được phòng" description="Vui lòng kiểm tra kết nối và thử lại." action={<Button onClick={() => { void roomsQuery.refetch(); void statsQuery.refetch(); }}>Thử lại</Button>} />}

    <CmsListCard variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>{roomsQuery.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>
      <CmsFilterBar>
        <CmsFilterField label="Tìm loại phòng / mã căn" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }} />
        <Autocomplete
          options={buildingOptions}
          value={buildingOptions.find((building) => building.code === buildingCode || building.id === buildingCode) || null}
          onChange={(_, building) => {
            buildingAutocomplete.rememberOption(building);
            const nextBuilding = building?.code || '';
            setBuildingCode(nextBuilding);
            const nextParams = new URLSearchParams(searchParams);
            if (nextBuilding) nextParams.set('building', nextBuilding);
            else nextParams.delete('building');
            setSearchParams(nextParams, { replace: true });
            setPage(0);
          }}
          onInputChange={(_, value, reason) => {
            updateAutocompleteSearch(setBuildingSearch, value, reason);
          }}
          loading={buildingsQuery.isFetching}
          getOptionLabel={(building) => `${building.code} · ${building.name}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          noOptionsText="Không tìm thấy tòa nhà"
          renderInput={(params) => <CmsFilterField {...params} label="Tòa nhà" placeholder="Tất cả tòa nhà" />}
          sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
        />
        <CmsFilterField select label="Trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as '' | 'active' | 'archived'); setPage(0); }}>
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="active">Đang hoạt động ({activeCount})</MenuItem>
          <MenuItem value="archived">Lưu trữ ({archivedCount})</MenuItem>
        </CmsFilterField>
        <CmsFilterField select label="Khả dụng" value={availability} onChange={(event) => { setAvailability(event.target.value); setPage(0); }}>
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="available">Còn căn trống</MenuItem>
          <MenuItem value="full">Hết căn trống</MenuItem>
          <MenuItem value="empty">Chưa có căn</MenuItem>
        </CmsFilterField>
      </CmsFilterBar>

      {roomsQuery.isPending ? <LoadingState label="Đang tải loại phòng…" minHeight={280} /> :
        !visible.length ? <EmptyState icon={<DoorOpen size={34} />} title="Không có loại phòng phù hợp" description="Thử thay đổi bộ lọc hoặc thêm loại phòng mới." action={<Button onClick={() => navigate('/cms/rooms/new')}>Thêm loại phòng</Button>} /> :
          <>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Loại phòng</TableCell>
                  <TableCell>Tòa nhà</TableCell>
                  <TableCell>Thông số</TableCell>
                  <TableCell>Giá / tháng</TableCell>
                  <TableCell>Tồn</TableCell>
                  <TableCell>Khả dụng</TableCell>
                  <CmsActionsCell>Thao tác</CmsActionsCell>
                </TableRow></TableHead>
                <TableBody>
                  {visible.map((room) => <TableRow
                    key={room.id}
                    hover
                    tabIndex={0}
                    role="button"
                    onClick={() => navigate(`/cms/rooms/${encodeURIComponent(room.id)}/edit`)}
                    onKeyDown={(event) => {
                      if (!['Enter', ' '].includes(event.key)) return;
                      event.preventDefault();
                      navigate(`/cms/rooms/${encodeURIComponent(room.id)}/edit`);
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                        <Avatar variant="rounded" src={room.coverImage || room.images[0] || undefined} sx={{ width: 46, height: 46 }}><DoorOpen size={20} /></Avatar>
                        <Box><Typography variant="body2" title={room.id} sx={{ fontWeight: 800 }}>{room.type}</Typography></Box>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{room.buildingCode}</Typography><Typography variant="caption" color="text.secondary">{room.buildingName}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{room.area} m²</Typography><Typography variant="caption" color="text.secondary">{room.maxOccupants} người</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{formatMoney(room.price)}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{room.vacantCount}/{room.totalUnits} trống</Typography><Typography variant="caption" color="text.secondary">{room.totalUnits} căn</Typography></TableCell>
                    <TableCell><Chip size="small" color={room.vacantCount > 0 ? 'success' : room.totalUnits > 0 ? 'warning' : 'default'} variant="outlined" label={room.status} /></TableCell>
                    <CmsActionsCell>{renderActions(room)}</CmsActionsCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
              {visible.map((room) => <Box key={room.id} sx={{ p: 2 }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'start' }}>
                  <Avatar variant="rounded" src={room.coverImage || room.images[0] || undefined} sx={{ width: 50, height: 50 }}><DoorOpen size={20} /></Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>{room.type}</Typography>
                    <Typography variant="body2" color="text.secondary">{room.buildingCode} · {formatMoney(room.price)}</Typography>
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" label={`${room.vacantCount}/${room.totalUnits} trống`} />
                      <Chip size="small" variant="outlined" label={room.status} />
                    </Stack>
                  </Box>
                  {renderActions(room)}
                </Stack>
              </Box>)}
            </Stack>
          </>}

      {roomsQuery.data && <TablePagination component="div" count={totalRooms} page={page} rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Số dòng:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        sx={{ borderTop: 1, borderColor: 'divider' }} />}
    </CmsListCard>

    

    {details && <RoomDetailsDialog room={details} onClose={() => setDetails(null)} onEdit={() => {
      navigate(`/cms/rooms/${encodeURIComponent(details.id)}/edit`);
      setDetails(null);
    }} />}

    <ConfirmDialog open={Boolean(action)} loading={busy} onClose={() => setAction(null)} onConfirm={performAction}
      title={action?.kind === 'delete' ? 'Xóa vĩnh viễn loại phòng?' : action?.kind === 'restore' ? 'Khôi phục loại phòng?' : 'Lưu trữ loại phòng?'}
      description={action ? action.kind === 'delete'
        ? `Xóa “${action.room.type}”? API sẽ chặn nếu còn căn hoặc lịch sử lịch xem.`
        : action.kind === 'restore'
          ? `Khôi phục “${action.room.type}” về trạng thái hoạt động?`
          : `Lưu trữ “${action.room.type}”? Các căn được giữ nguyên và loại phòng sẽ ẩn khỏi public.` : ''}
      confirmLabel={action?.kind === 'delete' ? 'Xóa vĩnh viễn' : action?.kind === 'restore' ? 'Khôi phục' : 'Lưu trữ'}
      danger={action?.kind === 'delete'} />

  </Stack>;
}
