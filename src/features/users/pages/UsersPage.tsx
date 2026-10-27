import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState } from 'react';
import { Avatar, Box, Button, Divider, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Eye, Check, CircleX, KeyRound, LockKeyhole, Pencil, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { USER_STATUSES, type UserStatus, type UserSummary } from '@tinyhouse/contracts';
import { designTokens } from '../../../app/theme/tokens';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { EmptyState } from '../../../components/ui/feedback/EmptyState';
import { ErrorState } from '../../../components/ui/feedback/ErrorState';
import { LoadingState } from '../../../components/ui/feedback/LoadingState';
import { toast } from '../../../lib/toast';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { AppIdentity } from '../../auth/identityStore';
import { useRolesQuery } from '../../roles/api/role.queries';
import { useDeleteUserMutation, useUsersPageQuery, useUserStatusMutation } from '../api';
import { ResetUserPasswordDialog } from '../components/ResetUserPasswordDialog';
import { UserEditorDialog } from '../components/UserEditorDialog';
import { canonicalUserStatus, isAdminRole, userErrorMessage } from '../userPresentation';

type Action = { user: UserSummary; kind: 'delete' } | { user: UserSummary; kind: 'status'; status: UserStatus };

function Status({ status }: { status: string }) {
  const canonical = canonicalUserStatus(status);
  const color = canonical === 'Hoạt động' ? 'success' : canonical === 'Chờ duyệt' ? 'warning' : canonical === 'Đã khóa' ? 'error' : 'default';
  return <Chip label={canonical || status || 'Chưa xác định'} color={color} size="small" variant="outlined" />;
}

export function UsersPage({ currentUser }: { currentUser: AppIdentity }) {
  const navigate = useNavigate();
  const showUser = (id: string) => navigate(`/cms/users/${encodeURIComponent(id)}`);
  const rolesQuery = useRolesQuery();
  const statusMutation = useUserStatusMutation();
  const deleteMutation = useDeleteUserMutation();
  const [reviewFilter, setReviewFilter] = useState<'' | 'pending'>('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [editor, setEditor] = useState<{ user?: UserSummary } | null>(null);
  const [resetUser, setResetUser] = useState<UserSummary | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  
  const debouncedSearch = useDebouncedValue(search, 350);
  const usersQuery = useUsersPageQuery({
    page: page + 1,
    pageSize: rowsPerPage,
    search: debouncedSearch,
    roleCode: roleFilter,
    status: statusFilter,
    review: reviewFilter,
    sort: 'createdAt',
    order: 'desc',
  });
  const users = usersQuery.data?.items || [];
  const roles = rolesQuery.data || [];
  const currentUserId = String(currentUser?.id || '');
  const editorReady = !rolesQuery.isPending && !rolesQuery.isError && roles.length > 0;
  const busy = statusMutation.isPending || deleteMutation.isPending;
  const fetching = usersQuery.isFetching || rolesQuery.isFetching;

  const visibleUsers = users;
  const totalUsers = usersQuery.data?.pagination.total || 0;
  const resetFilters = () => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setReviewFilter(''); setPage(0); };

  const beginStatus = (user: UserSummary, status: UserStatus) => {
    
    setAction({ user, kind: 'status', status });
  };

  const confirmAction = async () => {
    if (!action || busy) return;
    try {
      if (action.kind === 'delete') {
        await deleteMutation.mutateAsync(action.user.id);
        toast.success('Đã xóa tài khoản.');
      } else {
        await statusMutation.mutateAsync({ id: action.user.id, status: action.status });
        toast.success(action.status === 'Hoạt động' ? 'Đã kích hoạt tài khoản.' : `Đã chuyển tài khoản sang trạng thái ${action.status.toLowerCase()}.`);
      }
      setAction(null);
    } catch (error) { toast.error(userErrorMessage(error)); }
  };

  const renderActions = (user: UserSummary) => <CmsRowActions disabled={busy} actions={[
 {id:'view',label:'Xem chi tiết tài khoản',icon:<Eye />,onClick:()=>showUser(user.id)},
 {id:'edit',label:'Chỉnh sửa tài khoản',icon:<Pencil />,disabled:!editorReady,onClick:()=>setEditor({user})},
 {id:'reset',label:'Đặt lại mật khẩu',icon:<KeyRound />,disabled:user.id===currentUserId,onClick:()=>setResetUser(user)},
 {id:'approve',label:'Duyệt tài khoản',icon:<Check />,hidden:canonicalUserStatus(user.status)!=='Chờ duyệt',disabled:user.id===currentUserId,onClick:()=>beginStatus(user,'Hoạt động')},
 {id:'reject',label:'Từ chối tài khoản',icon:<CircleX />,hidden:canonicalUserStatus(user.status)!=='Chờ duyệt',disabled:user.id===currentUserId,onClick:()=>beginStatus(user,'Từ chối')},
 {id:'status',label:canonicalUserStatus(user.status)==='Hoạt động'?'Khóa tài khoản':'Kích hoạt tài khoản',icon:canonicalUserStatus(user.status)==='Hoạt động'?<LockKeyhole />:<Check />,hidden:canonicalUserStatus(user.status)==='Chờ duyệt',disabled:user.id===currentUserId,onClick:()=>beginStatus(user,canonicalUserStatus(user.status)==='Hoạt động'?'Đã khóa':'Hoạt động')},
 {id:'delete',label:'Xóa tài khoản',icon:<Trash2 />,danger:true,disabled:user.id===currentUserId||isAdminRole(user.roleCode),onClick:()=>setAction({kind:'delete',user})},
]} />;

  return (
    <Stack spacing={3}>
      <CmsPageHeader title={<> Quản lý tài khoản </>} description={<> Tạo tài khoản, duyệt người dùng và quản lý trạng thái truy cập. </>} actions={<><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button component={RouterLink} to="/cms/permissions" color="inherit" startIcon={<ShieldCheck size={18} />}>Vai trò & quyền</Button>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setEditor({})} disabled={!editorReady}>Tạo tài khoản</Button>
        </Stack></>} />

      {rolesQuery.isError && <ErrorState title="Không tải được vai trò" description="Vui lòng tải lại vai trò để tạo hoặc chỉnh sửa tài khoản."
        action={<Button color="inherit" onClick={() => void rolesQuery.refetch()}>Thử lại</Button>} />}
      {rolesQuery.isSuccess && !roles.length && <ErrorState title="Chưa có vai trò" description="Hãy tạo vai trò trước khi thêm tài khoản."
        action={<Button component={RouterLink} to="/cms/permissions" color="inherit">Quản lý vai trò</Button>} />}
      {usersQuery.isError && <ErrorState title="Không tải được tài khoản" description={usersQuery.data ? 'Đang hiển thị dữ liệu lần tải trước. Vui lòng thử lại để cập nhật.' : 'Vui lòng kiểm tra kết nối và thử lại.'}
        action={<Button color="inherit" onClick={() => void usersQuery.refetch()}>Thử lại</Button>} />}

      <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 3 }}>{fetching && <LinearProgress sx={{ height: 3 }} />}</Box>
        <CmsFilterBar>
          <CmsFilterField label="Tìm tài khoản" placeholder="Họ tên, email hoặc số điện thoại" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            fullWidth sx={{ minWidth: 0 }} slotProps={{ inputLabel: { shrink: true }, input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }} />
          <CmsFilterField label="Xét duyệt" value={reviewFilter} select onChange={(event) => { setReviewFilter(event.target.value as '' | 'pending'); setPage(0); }}
            fullWidth sx={{ minWidth: 0 }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="pending">Chờ duyệt</MenuItem>
          </CmsFilterField>
          <CmsFilterField label="Vai trò" value={roleFilter} select onChange={(event) => { setRoleFilter(event.target.value); setPage(0); }}
            fullWidth sx={{ minWidth: 0 }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="">Tất cả vai trò</MenuItem>
            {roles.map((role) => <MenuItem key={role.id} value={role.code}>{role.name}</MenuItem>)}
          </CmsFilterField>
          <CmsFilterField label="Trạng thái" value={statusFilter} select onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}
            fullWidth sx={{ minWidth: 0 }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            {USER_STATUSES.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
          </CmsFilterField>
        </CmsFilterBar>

        {usersQuery.isPending ? <LoadingState label="Đang tải tài khoản…" minHeight={260} /> : !usersQuery.data && usersQuery.isError ? null : !visibleUsers.length ? (
          <EmptyState icon={<Users size={36} />} title={totalUsers ? 'Không tìm thấy tài khoản' : 'Chưa có tài khoản'}
            description={totalUsers ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Tạo tài khoản để bắt đầu quản lý người dùng.'}
            action={totalUsers ? <Button onClick={resetFilters}>Xóa bộ lọc</Button> : <Button onClick={() => setEditor({})} disabled={!editorReady}>Tạo tài khoản</Button>} />
        ) : (
          <>
            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table aria-label="Danh sách tài khoản">
                <TableHead><TableRow>
                  <TableCell>Người dùng</TableCell><TableCell>Liên hệ</TableCell><TableCell>Vai trò</TableCell><TableCell>Trạng thái</TableCell><CmsActionsCell>Thao tác</CmsActionsCell>
                </TableRow></TableHead>
                <TableBody>{visibleUsers.map((user) => <TableRow
                  key={user.id}
                  hover
                  tabIndex={0}
                  role="button"
                  onClick={() => showUser(user.id)}
                  onKeyDown={(event) => {
                    if (!['Enter', ' '].includes(event.key)) return;
                    event.preventDefault();
                    showUser(user.id);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell><Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Avatar src={user.avatar || undefined} alt="" sx={{
                      width: 40, height: 40, flexShrink: 0,
                      bgcolor: designTokens.colors.brand[100], color: designTokens.colors.navy[900],
                      fontSize: 16, fontWeight: 700, border: '1px solid', borderColor: designTokens.colors.brand[200],
                    }}>{(user.name.trim() || user.email).charAt(0).toUpperCase()}</Avatar>
                    <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{user.name || 'Chưa có tên'}</Typography>
                      {user.id === currentUserId && <Typography variant="caption" color="text.secondary">Tài khoản của bạn</Typography>}
                    </Box>
                  </Stack></TableCell>
                  <TableCell><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{user.email}</Typography><Typography variant="caption" color="text.secondary">{user.phone || 'Chưa có số điện thoại'}</Typography></TableCell>
                  <TableCell>{user.roleName || user.roleCode || 'Chưa gán'}</TableCell>
                  <TableCell><Status status={user.status} /></TableCell>
                  <CmsActionsCell>{renderActions(user)}</CmsActionsCell>
                </TableRow>)}</TableBody>
              </Table>
            </TableContainer>
            <Stack divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>
              {visibleUsers.map((user) => <Box key={user.id} sx={{ px: 2, py: 2 }}>
                <Stack direction="row" sx={{ alignItems: 'start', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component={RouterLink} to={`/cms/users/${encodeURIComponent(user.id)}`} sx={{ color: 'text.primary', fontWeight: 700, overflowWrap: 'anywhere' }}>{user.name || 'Chưa có tên'}{user.id === currentUserId ? ' (Bạn)' : ''}</Typography>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{user.email}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{user.phone || 'Chưa có số điện thoại'}</Typography>
                  </Box>
                  {renderActions(user)}
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip size="small" label={user.roleName || user.roleCode || 'Chưa gán vai trò'} /><Status status={user.status} />
                </Stack>
              </Box>)}
            </Stack>
          </>
        )}
        {usersQuery.data && <TablePagination component="div" count={totalUsers} page={page} rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]} labelRowsPerPage="Số dòng:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          getItemAriaLabel={(type) => type === 'next' ? 'Trang tiếp theo' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'}
          onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
          sx={{ borderTop: 1, borderColor: 'divider', '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'end', pl: 2 }, '& .MuiTablePagination-spacer': { display: 'none' } }} />}
      </CmsListCard>

      

      {editor && <UserEditorDialog user={editor.user} roles={roles} currentUserId={currentUserId} onClose={() => setEditor(null)} />}
      {resetUser && <ResetUserPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />}
      <ConfirmDialog open={Boolean(action)} loading={busy} onClose={() => setAction(null)} onConfirm={confirmAction}
        title={action?.kind === 'delete' ? 'Xóa tài khoản?' : action?.kind === 'status' && action.status === 'Hoạt động' ? 'Kích hoạt tài khoản?' : 'Đổi trạng thái tài khoản?'}
        description={action ? action.kind === 'delete'
          ? `Xóa tài khoản ${action.user.name} (${action.user.email})? Người dùng sẽ không thể đăng nhập bằng tài khoản này. Thao tác không thể hoàn tác.`
          : `Chuyển tài khoản ${action.user.name} (${action.user.email}) sang trạng thái “${action.status}”?`
          : ''}
        confirmLabel={action?.kind === 'delete' ? 'Xóa tài khoản' : 'Xác nhận'} danger={action?.kind === 'delete' || (action?.kind === 'status' && ['Đã khóa', 'Từ chối'].includes(action.status))} />
    </Stack>
  );
}
