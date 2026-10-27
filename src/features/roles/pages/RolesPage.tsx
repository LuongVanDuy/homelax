import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Box, Button, Divider, InputAdornment, LinearProgress, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { Copy, Pencil, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Link as RouterLink } from 'react-router';
import { CMS_ROLE_SCREENS, type RoleSummary } from '@tinyhouse/contracts';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { AppIdentity } from '../../auth/identityStore';
import { useDeleteRoleMutation, useRolesPageQuery } from '../api';
import { RoleEditorDialog } from '../components/RoleEditorDialog';
import { editableRoleScreens, isSystemRole, roleCanBeDeleted, roleDeleteReason, roleErrorMessage, unsupportedRoleScreens } from '../rolePresentation';

type Editor = { role?: RoleSummary; duplicate?: boolean };

function RolePermissions({ role }: { role: RoleSummary }) {
  if (isSystemRole(role.code)) return <Chip label="Toàn quyền" size="small" color="primary" variant="outlined" />;
  const screens = editableRoleScreens(role);
  const labels = CMS_ROLE_SCREENS.filter((screen) => screens.includes(screen.code)).map((screen) => screen.label);
  const unsupported = unsupportedRoleScreens(role);
  return <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
    {labels.length === 0 && <Typography variant="body2" color="text.secondary">Chưa có quyền CMS</Typography>}
    {labels.slice(0, 2).map((label) => <Chip key={label} label={label} size="small" variant="outlined" />)}
    {labels.length > 2 && <Tooltip title={labels.slice(2).join(', ')}><Chip label={`+${labels.length - 2}`} size="small" variant="outlined" tabIndex={0} /></Tooltip>}
    {unsupported.length > 0 && <Tooltip title={`Quyền cũ: ${unsupported.join(', ')}`}><Chip label="Quyền cũ" color="warning" size="small" variant="outlined" tabIndex={0} /></Tooltip>}
  </Stack>;
}

export function RolesPage({ currentUser }: { currentUser: AppIdentity }) {
  const deleteMutation = useDeleteRoleMutation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<RoleSummary | null>(null);
  
  const debouncedSearch = useDebouncedValue(search, 350);
  const rolesQuery = useRolesPageQuery({
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    sort: 'createdAt',
    order: 'asc',
  });
  const fetching = rolesQuery.isFetching;
  const visibleRoles = rolesQuery.data?.items || [];
  const totalRoles = rolesQuery.data?.pagination.total || 0;
  const countFor = (role: RoleSummary & { userCount?: number }) => role.userCount ?? 0;
  

  

  const renderActions = (role: RoleSummary) => <CmsRowActions disabled={deleteMutation.isPending} actions={[
 {id:'edit',label:'Chỉnh sửa vai trò',icon:<Pencil />,onClick:()=>setEditor({role})},
 {id:'copy',label:'Nhân bản vai trò',icon:<Copy />,onClick:()=>setEditor({role,duplicate:true})},
 {id:'delete',label:'Xóa vai trò',icon:<Trash2 />,danger:true,disabled:!roleCanBeDeleted(role,countFor(role)),disabledReason:roleDeleteReason(role,countFor(role))||undefined,onClick:()=>setDeleting(role)},
]} />;

  return (
    <Stack spacing={3}>
      <CmsPageHeader title={<> Vai trò & quyền </>} description={<> Quản lý vai trò và quyền truy cập hệ thống. </>} actions={<><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button component={RouterLink} to="/cms/users" color="inherit" startIcon={<Users size={18} />}>Tài khoản</Button>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setEditor({})}>Tạo vai trò</Button>
        </Stack></>} />

      {rolesQuery.isError && <ErrorState title="Không tải được vai trò" description={rolesQuery.data ? 'Đang hiển thị dữ liệu lần tải trước.' : 'Vui lòng thử lại.'}
        action={<Button color="inherit" onClick={() => void rolesQuery.refetch()}>Thử lại</Button>} />}

      <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 3 }}>{fetching && <LinearProgress sx={{ height: 3 }} />}</Box>
        <CmsFilterBar>
          <CmsFilterField label="Tìm vai trò" placeholder="Tên hoặc mã vai trò" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            sx={{ minWidth: 0 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }} />
        </CmsFilterBar>

        {rolesQuery.isPending ? <LoadingState label="Đang tải vai trò…" minHeight={250} /> : !rolesQuery.data && rolesQuery.isError ? null : !visibleRoles.length ? (
          <EmptyState icon={<ShieldCheck size={36} />} title={totalRoles ? 'Không tìm thấy vai trò' : 'Chưa có vai trò'}
            action={totalRoles ? <Button onClick={() => { setSearch(''); setPage(0); }}>Xóa tìm kiếm</Button> : <Button onClick={() => setEditor({})}>Tạo vai trò</Button>} />
        ) : <>
          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table aria-label="Danh sách vai trò">
              <TableHead><TableRow><TableCell>Vai trò</TableCell><TableCell>Mã</TableCell><TableCell align="center">Tài khoản</TableCell><TableCell>Quyền truy cập</TableCell><CmsActionsCell>Thao tác</CmsActionsCell></TableRow></TableHead>
              <TableBody>{visibleRoles.map((role) => <TableRow
                key={role.id}
                hover
                tabIndex={0}
                role="button"
                onClick={() => setEditor({ role })}
                onKeyDown={(event) => {
                  if (!['Enter', ' '].includes(event.key)) return;
                  event.preventDefault();
                  setEditor({ role });
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{role.name}</Typography>
                  {role.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}>{role.description}</Typography>}
                  {role.code === currentUser?.roleCode && <Typography variant="caption" color="text.secondary">Vai trò của bạn</Typography>}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', maxWidth: 180 }}>{role.code}</TableCell>
                <TableCell align="center">{countFor(role) ?? '-'}</TableCell>
                <TableCell sx={{ maxWidth: 340 }}><RolePermissions role={role} /></TableCell>
                <CmsActionsCell>{renderActions(role)}</CmsActionsCell>
              </TableRow>)}</TableBody>
            </Table>
          </TableContainer>
          <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
            {visibleRoles.map((role) => <Box key={role.id} sx={{ p: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'start', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{role.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{role.code} · {countFor(role) ?? '-'} tài khoản</Typography>
                </Box>
                {renderActions(role)}
              </Stack>
              {role.description && <Typography variant="body2" color="text.secondary" sx={{ my: 1, overflowWrap: 'anywhere' }}>{role.description}</Typography>}
              <Box sx={{ mt: 1.5 }}><RolePermissions role={role} /></Box>
            </Box>)}
          </Stack>
        </>}

        {rolesQuery.data && <TablePagination component="div" count={totalRoles} page={page} rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Số dòng:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          getItemAriaLabel={(type) => type === 'next' ? 'Trang tiếp theo' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'}
          onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
          sx={{ borderTop: 1, borderColor: 'divider', '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'end', pl: 2 }, '& .MuiTablePagination-spacer': { display: 'none' } }} />}
      </CmsListCard>

      
      {editor && <RoleEditorDialog role={editor.role} duplicate={editor.duplicate} onClose={() => setEditor(null)} />}
      <ConfirmDialog open={Boolean(deleting)} title="Xóa vai trò?" confirmLabel="Xóa vai trò" danger loading={deleteMutation.isPending}
        description={deleting ? `Xóa vai trò “${deleting.name}” (${deleting.code})? Thao tác không thể hoàn tác.` : ''}
        onClose={() => setDeleting(null)} onConfirm={async () => {
          if (!deleting || deleteMutation.isPending) return;
          try {
            await deleteMutation.mutateAsync(deleting.id);
            toast.success('Đã xóa vai trò.');
            setDeleting(null);
          } catch (error) { toast.error(roleErrorMessage(error)); }
        }} />
    </Stack>
  );
}
