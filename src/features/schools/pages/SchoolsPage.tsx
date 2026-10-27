import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Box, Button, Dialog, DialogContent, DialogTitle, Divider, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Archive, ArchiveRestore, MapPin, Pencil, Plus, Ruler, Search, Trash2 } from 'lucide-react';
import { DEFAULT_SCHOOL_RADIUS_KM, type School, type SchoolLocationFilter, type SchoolStatus } from '@tinyhouse/contracts';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { toast } from '../../../lib/toast';
import { useArchiveSchoolMutation, useDeleteSchoolMutation, useRestoreSchoolMutation, useSchoolDistancesQuery, useSchoolsPageQuery } from '../api';
import { SchoolEditorDialog } from '../components/SchoolEditorDialog';
import { schoolCoordinateLabel, schoolErrorMessage } from '../schoolPresentation';

type Action = {
  school: School;
  kind: 'archive' | 'restore' | 'delete';
};

type SortMode = 'name-asc' | 'updated-desc' | 'radius-asc';

const statusLabels: Record<SchoolStatus, string> = {
  active: 'Đang hoạt động',
  archived: 'Lưu trữ',
};

function radiusLabel(radiusKm: number | null) {
  return radiusKm === null
    ? `Mặc định ${DEFAULT_SCHOOL_RADIUS_KM} km`
    : `${radiusKm} km`;
}

export function SchoolsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SchoolStatus | ''>('active');
  const [location, setLocation] = useState<SchoolLocationFilter | ''>('');
  const [sortMode, setSortMode] = useState<SortMode>('name-asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [editor, setEditor] = useState<School | 'new' | null>(null);
  
  const [action, setAction] = useState<Action | null>(null);
  const [distanceSchool, setDistanceSchool] = useState<School | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);

  const sort = sortMode === 'updated-desc'
    ? 'updatedAt'
    : sortMode === 'radius-asc'
      ? 'radiusKm'
      : 'name';
  const order = sortMode === 'updated-desc' ? 'desc' : 'asc';

  const query = useSchoolsPageQuery({
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    status,
    location,
    sort,
    order,
  });
  const schools = query.data?.items || [];
  const total = query.data?.pagination.total || 0;
  const canCalculateDistance = Boolean(
    distanceSchool && distanceSchool.latitude !== null && distanceSchool.longitude !== null,
  );
  const distanceQuery = useSchoolDistancesQuery(
    distanceSchool?.id || '',
    canCalculateDistance,
  );

  const archive = useArchiveSchoolMutation();
  const restore = useRestoreSchoolMutation();
  const remove = useDeleteSchoolMutation();
  const busy = archive.isPending || restore.isPending || remove.isPending;

  const perform = async () => {
    if (!action) return;
    try {
      if (action.kind === 'archive') {
        await archive.mutateAsync(action.school.id);
        toast.success('Đã lưu trữ trường học.');
      } else if (action.kind === 'restore') {
        await restore.mutateAsync(action.school.id);
        toast.success('Đã khôi phục trường học.');
      } else {
        await remove.mutateAsync(action.school.id);
        toast.success('Đã xóa trường học.');
      }
      setAction(null);
    } catch (error) {
      toast.error(schoolErrorMessage(error));
    }
  };

  const renderActions = (school: School) => <CmsRowActions disabled={busy} actions={[
 {id:'edit',label:'Chỉnh sửa',icon:<Pencil />,onClick:()=>setEditor(school)},
 {id:'distance',label:'Xem khoảng cách',icon:<Ruler />,onClick:()=>setDistanceSchool(school)},
 {id:'archive',label:school.status==='archived'?'Khôi phục':'Lưu trữ',icon:school.status==='archived'?<ArchiveRestore />:<Archive />,onClick:()=>setAction({school,kind:school.status==='archived'?'restore':'archive'})},
 {id:'delete',label:'Xóa vĩnh viễn',icon:<Trash2 />,danger:true,onClick:()=>setAction({school,kind:'delete'})},
]} />;

  return <Stack spacing={3}>
    <CmsPageHeader title={<> Quản lý trường học </>} description={<> Quản lý trường học, vị trí và khoảng cách đến các tòa nhà. </>} actions={<><Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setEditor('new')}>
        Thêm trường học
      </Button></>} />

    <CmsListCard variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>{query.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>

      <CmsFilterBar>
        <CmsFilterField
          label="Tìm trường học"
          placeholder="Tên trường, cơ sở, địa chỉ..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>,
            },
          }}
        />
        <CmsFilterField
          select
          label="Trạng thái"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as SchoolStatus | '');
            setPage(0);
          }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="active">Đang hoạt động</MenuItem>
          <MenuItem value="archived">Lưu trữ</MenuItem>
        </CmsFilterField>
        <CmsFilterField
          select
          label="Dữ liệu vị trí"
          value={location}
          onChange={(event) => {
            setLocation(event.target.value as SchoolLocationFilter | '');
            setPage(0);
          }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="complete">Có tọa độ + bán kính riêng</MenuItem>
          <MenuItem value="missingCoordinates">Thiếu tọa độ</MenuItem>
          <MenuItem value="missingRadius">Đang dùng bán kính mặc định</MenuItem>
        </CmsFilterField>
        <CmsFilterField
          select
          label="Sắp xếp"
          value={sortMode}
          onChange={(event) => {
            setSortMode(event.target.value as SortMode);
            setPage(0);
          }}
        >
          <MenuItem value="name-asc">Tên A–Z</MenuItem>
          <MenuItem value="updated-desc">Mới cập nhật</MenuItem>
          <MenuItem value="radius-asc">Bán kính tăng dần</MenuItem>
        </CmsFilterField>
      </CmsFilterBar>

      <Divider />

      {query.isError && <ErrorState
        title="Không tải được danh mục trường"
        description="Vui lòng thử lại."
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
      />}

      {query.isPending ? <LoadingState label="Đang tải trường học…" minHeight={300} /> :
        !schools.length ? <EmptyState
          title="Chưa có trường học phù hợp"
          description="Thử đổi trạng thái, dữ liệu vị trí hoặc từ khóa tìm kiếm."
        /> :
        <>
          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Trường / cơ sở</TableCell>
                  <TableCell>Địa chỉ</TableCell>
                  <TableCell>Dữ liệu vị trí</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <CmsActionsCell>Thao tác</CmsActionsCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schools.map((school) => <TableRow
                  key={school.id}
                  hover
                  onClick={() => setEditor(school)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ minWidth: 240 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>{school.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {school.campus || school.shortName || 'Chưa tách cơ sở'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 240 }}>
                    <Typography variant="body2">{school.address}</Typography>
                    {school.ward && <Typography variant="caption" color="text.secondary">{school.ward}</Typography>}
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Stack spacing={0.65}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <MapPin size={15} />
                        <Typography variant="body2">
                          {schoolCoordinateLabel(school.latitude, school.longitude)}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        color={school.radiusKm === null ? 'warning.main' : 'text.secondary'}
                      >
                        {radiusLabel(school.radiusKm)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={school.status === 'active' ? 'success' : 'default'}
                      label={statusLabels[school.status]}
                    />
                  </TableCell>
                  <CmsActionsCell>
                    {renderActions(school)}
                  </CmsActionsCell>
                </TableRow>)}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {schools.map((school) => <Box
              key={school.id}
              onClick={() => setEditor(school)}
              sx={{ p: 2, cursor: 'pointer' }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }}>{school.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {school.campus || school.shortName || 'Chưa tách cơ sở'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.75 }}>{school.address}</Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={school.latitude === null ? 'Chưa có tọa độ' : 'Đã có tọa độ'}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={radiusLabel(school.radiusKm)}
                    />
                    {school.status === 'archived' && <Chip size="small" variant="outlined" label="Lưu trữ" />}
                  </Stack>
                </Box>
                {renderActions(school)}
              </Stack>
            </Box>)}
          </Stack>
        </>}

      {query.data && <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="Số dòng:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        onPageChange={(_, value) => setPage(value)}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        sx={{ borderTop: 1, borderColor: 'divider' }}
      />}
    </CmsListCard>

    

    {editor && <SchoolEditorDialog
      school={editor === 'new' ? undefined : editor}
      onClose={() => setEditor(null)}
    />}

    <Dialog
      open={Boolean(distanceSchool)}
      onClose={() => setDistanceSchool(null)}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        Khoảng cách từ {distanceSchool?.name || 'trường học'}
      </DialogTitle>
      <DialogContent dividers>
        {!canCalculateDistance ? (
          <Typography color="text.secondary">
            Trường/cơ sở này chưa có tọa độ. Cập nhật vĩ độ và kinh độ trước khi tính khoảng cách.
          </Typography>
        ) : distanceQuery.isPending ? (
          <LoadingState label="Đang tính khoảng cách…" minHeight={180} />
        ) : distanceQuery.isError ? (
          <ErrorState
            title="Không tính được khoảng cách"
            description="Vui lòng kiểm tra dữ liệu tọa độ và thử lại."
            action={<Button onClick={() => void distanceQuery.refetch()}>Thử lại</Button>}
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tòa nhà</TableCell>
                  <TableCell>Địa chỉ</TableCell>
                  <TableCell align="right">Khoảng cách</TableCell>
                  <TableCell>Bán kính trường</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(distanceQuery.data?.buildings || []).map((building) => (
                  <TableRow key={building.buildingId}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{building.buildingName}</Typography>
                      <Typography variant="caption" color="text.secondary">{building.buildingCode}</Typography>
                    </TableCell>
                    <TableCell>{building.address}</TableCell>
                    <TableCell align="right">{building.distanceKm.toFixed(3)} km</TableCell>
                    <TableCell>
                      <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={building.withinRadius ? 'success' : 'default'}
                          label={building.withinRadius ? 'Trong bán kính' : 'Ngoài bán kính'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {building.effectiveRadiusKm} km · {building.radiusSource === 'default' ? 'mặc định' : 'riêng'}
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={Boolean(action)}
      loading={busy}
      onClose={() => setAction(null)}
      onConfirm={perform}
      title={
        action?.kind === 'delete'
          ? 'Xóa trường học?'
          : action?.kind === 'restore'
            ? 'Khôi phục trường học?'
            : 'Lưu trữ trường học?'
      }
      description={action
        ? action.kind === 'delete'
          ? `Xóa “${action.school.name}”? Chỉ dùng khi bản ghi không còn cần giữ.`
          : action.kind === 'restore'
            ? `Khôi phục “${action.school.name}” để đưa lại vào danh mục?`
            : `Lưu trữ “${action.school.name}”? Dữ liệu vẫn được giữ để có thể khôi phục.`
        : ''
      }
      confirmLabel={
        action?.kind === 'delete'
          ? 'Xóa'
          : action?.kind === 'restore'
            ? 'Khôi phục'
            : 'Lưu trữ'
      }
      danger={action?.kind === 'delete'}
    />
  </Stack>;
}
