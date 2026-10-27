import { CmsActionsCell, CmsPageHeader, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../../components/cms';

import { useState, type ReactNode } from 'react';
import { Alert, Avatar, Box, Button, Divider, LinearProgress, Paper, Stack, Tab, Tabs, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { ArrowLeft, KeyRound, LockKeyhole, Pencil, Settings2, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { CMS_ROLE_SCREENS, type AccountDetail, type UserStatus } from '@tinyhouse/contracts';
import type { AppIdentity } from '../../auth/identityStore';
import { isCmsAdministrator } from '../../cms/navigation';
import { useRolesQuery } from '../../roles/api/role.queries';
import { useUserStatusMutation } from '../../users/api';
import { canonicalUserStatus, userErrorMessage } from '../../users/userPresentation';
import { UserEditorDialog } from '../../users/components/UserEditorDialog';
import { ResetUserPasswordDialog } from '../../users/components/ResetUserPasswordDialog';
import { ConfirmDialog } from '../../../components/ui/dialogs/ConfirmDialog';
import { toast } from '../../../lib/toast';
import { AccountProfileDialog } from '../components/AccountProfileDialog';
import { AccountPasswordDialog } from '../components/AccountPasswordDialog';
import { EmailVerificationPanel } from '../components/EmailVerificationPanel';
import { useAccountActivityQuery, useAccountDetailQuery, useAccountLinksQuery, useRefreshAccountData } from '../api/account.api';

function accountDisplayTime(value: string | null | undefined) {
  if (!value) return 'Chưa ghi nhận';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Chưa ghi nhận' : new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
  }).format(parsed);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return <Box sx={{ minWidth: 0 }}>
    <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
    <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.5, fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
      {value || 'Chưa cung cấp'}
    </Typography>
  </Box>;
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, minWidth: 0 }}>
    <Stack direction="row" spacing={1} sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography component="h2" sx={{ fontWeight: 800 }}>{title}</Typography>{action}
    </Stack>{children}
  </Paper>;
}

const scopeLabels = { none: 'Không có quyền', assigned: 'Chỉ dữ liệu được phân công', all: 'Toàn bộ dữ liệu' };
function AccessPanel({ data }: { data: AccountDetail }) {
  const p = data.permissions;
  const role = data.user.roleCode;
  const labels = new Map<string, string>(CMS_ROLE_SCREENS.map(item => [item.code, item.label]));
  const screens = role === 'ctv_sale'
    ? ['Khách của tôi', 'Tạo ảnh bán phòng', 'Lịch sử hoa hồng']
    : role === 'commission_accountant'
      ? ['Lịch sử hoa hồng · duyệt phần Kế toán']
      : p.allowedScreens.map(code => code === '*' ? 'Toàn quyền quản trị' : labels.get(code) || code);
  const actions = [
    [p.bookingCanAssign, 'Phân lịch'], [p.bookingCanReassign, 'Phân lại lịch'],
    [p.bookingCanTransition, 'Cập nhật trạng thái lịch'], [p.bookingCanCancel, 'Hủy lịch'],
    [p.bookingCanReschedule, 'Đổi giờ hẹn'], [p.dealCanCreate, 'Tạo giao dịch từ lịch'],
    [p.dealCanCreateDirect, 'Tạo giao dịch trực tiếp'], [p.dealCanManageContractDeposit, 'Quản lý hợp đồng/cọc'],
    [p.dealCanManageRentalSchedule, 'Cập nhật lịch thuê'], [p.dealCanManageLifecycle, 'Đổi căn / hủy giao dịch'],
  ] as const;
  return <Panel title="Vai trò và phạm vi truy cập">
    <Stack spacing={3}>
      <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{data.user.roleName || role}</Typography>
        <Typography variant="caption" color="text.secondary">Các quyền đang áp dụng cho tài khoản này.</Typography></Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {screens.length ? screens.map(label => <Chip key={label} label={label} size="small" variant="outlined" />) : <Typography color="text.secondary" variant="body2">Chưa được cấp màn hình nghiệp vụ.</Typography>}
      </Stack>
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Field label="Lịch xem phòng" value={scopeLabels[p.bookingScope]} />
        <Field label="Giao dịch thuê" value={scopeLabels[p.dealScope]} />
      </Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {actions.filter(([enabled]) => enabled).map(([, label]) => <Chip key={label} label={label} color="primary" size="small" variant="outlined" />)}
      </Stack>
    </Stack>
  </Panel>;
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  return <TablePagination component="div" count={total} page={page - 1} rowsPerPage={10} rowsPerPageOptions={[10]}
    labelRowsPerPage="Số dòng" labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
    getItemAriaLabel={type => type === 'next' ? 'Trang tiếp theo' : type === 'previous' ? 'Trang trước' : type}
    onPageChange={(_, next) => onPage(next + 1)} sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap' } }} />;
}

/** Same safe detail view; own-account and administrator modes have separate API authority. */
export function AccountPage({ currentUser, userId }: { currentUser: AppIdentity; userId?: string }) {
  const navigate = useNavigate();
  const administrator = isCmsAdministrator(currentUser);
  const permitted = Boolean(currentUser?.id) && (!userId || administrator);
  const self = !userId || userId === currentUser?.id;
  const [tab, setTab] = useState('profile');
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [adminEditor, setAdminEditor] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [nextStatus, setNextStatus] = useState<UserStatus | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [linksPage, setLinksPage] = useState(1);
  const detail = useAccountDetailQuery(userId, permitted);
  const roles = useRolesQuery(administrator && Boolean(userId));
  const related = administrator && Boolean(userId) && permitted;
  const activity = useAccountActivityQuery(userId || '', activityPage, related && tab === 'activity');
  const links = useAccountLinksQuery(userId || '', linksPage, related && tab === 'links');
  const changeStatus = useUserStatusMutation();
  const refresh = useRefreshAccountData();
  const data = detail.data;

  if (!permitted) return <Alert severity="error">Bạn không có quyền xem tài khoản này.</Alert>;
  if (detail.isError) return <Alert severity="error" action={<Button color="inherit" onClick={() => void detail.refetch()}>Thử lại</Button>}>
    Không tải được tài khoản hoặc tài khoản không còn tồn tại. <Button color="inherit" onClick={() => navigate(userId ? '/cms/users' : '/cms')}>Quay lại</Button>
  </Alert>;
  if (!data) return <Stack spacing={2} aria-busy="true"><Typography>Đang tải thông tin tài khoản…</Typography><LinearProgress /></Stack>;
  const user = data.user;
  const status = canonicalUserStatus(user.status);
  const statusColor = status === 'Hoạt động' ? 'success' : status === 'Chờ duyệt' ? 'warning' : status === 'Đã khóa' ? 'error' : 'default';
  const birth = user.birthDate ? user.birthDate.split('-').reverse().join('/') : '';

  return <Stack spacing={3}>
    <CmsPageHeader title={userId ? 'Chi tiết tài khoản' : 'Tài khoản của tôi'} description={<> Quản lý thông tin cá nhân và bảo mật tài khoản. </>} navigation={<>{userId && <Button component={RouterLink} to="/cms/users" color="inherit" startIcon={<ArrowLeft size={17} />} sx={{ ml: -1, mb: 0.5 }}>Danh sách tài khoản</Button>}</>} actions={<>{userId && self && <Button component={RouterLink} to="/cms/account" startIcon={<UserRound size={17} />}>Trang cá nhân của tôi</Button>}</>} />

    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ alignItems: { md: 'center' } }}>
        <Avatar src={user.avatar || undefined} alt={user.name} sx={{ width: 80, height: 80, fontSize: 28, bgcolor: 'primary.light' }}>{user.name.slice(0, 1)}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" variant="h6" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{user.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere', mb: 1 }}>{user.email}</Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip label={status} color={statusColor} size="small" variant="outlined" />
            <Chip label={user.roleName || user.roleCode} size="small" variant="outlined" />
            {self && <Chip label="Tài khoản của bạn" size="small" />}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<Pencil size={17} />} onClick={() => setProfileOpen(true)}>Sửa hồ sơ</Button>
          {related && <Button variant="outlined" startIcon={<Settings2 size={17} />} onClick={() => setAdminEditor(true)} disabled={!roles.data?.length || roles.isError}>Quản lý tài khoản</Button>}
        </Stack>
      </Stack>
    </Paper>

    <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Thông tin tài khoản">
      <Tab value="profile" label="Thông tin chung" />
      <Tab value="access" label="Vai trò & quyền" />
      {related && <Tab value="links" label="Hồ sơ liên kết" />}
      {related && <Tab value="activity" label="Nhật ký tài khoản" />}
    </Tabs>

    {tab === 'profile' && <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
      <Panel title="Hồ sơ cá nhân">
        <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' } }}>
          <Field label="Họ và tên" value={user.name} /><Field label="Số điện thoại" value={user.phone} />
          <Field label="Giới tính" value={user.gender ? { male: 'Nam', female: 'Nữ', other: 'Khác' }[user.gender] : ''} />
          <Field label="Ngày sinh" value={birth} />
          <Box sx={{ gridColumn: '1 / -1' }}><Field label="Địa chỉ cá nhân" value={user.address} /></Box>
          <Box sx={{ gridColumn: '1 / -1' }}><Field label="Email đăng nhập" value={user.email} /></Box>
        </Box>
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          {self ? <EmailVerificationPanel key={user.id} verifiedAt={user.emailVerifiedAt} />
            : <Field label="Xác thực email" value={user.emailVerifiedAt ? `Đã xác thực · ${accountDisplayTime(user.emailVerifiedAt)}` : 'Chưa xác thực'} />}
        </Box>
      </Panel>
      <Stack spacing={3}>
        <Panel title="Bảo mật và phiên truy cập">
          <Stack spacing={2}>
            <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2 }}>
              <Field label="Phương thức đăng nhập" value={user.authProvider === 'local' ? 'Email và mật khẩu' : user.authProvider} />
              <Field label="Mật khẩu" value={data.security.passwordSet ? 'Đã thiết lập' : 'Chưa thiết lập mật khẩu nội bộ'} />
              <Field label="Phiên làm mới còn hiệu lực" value={String(data.security.activeRefreshSessions)} />
              <Field label="Lần làm mới phiên gần nhất (UTC+7)" value={accountDisplayTime(data.security.lastRefreshAt)} />
            </Box>
            <Typography variant="caption" color="text.secondary">Số phiên dựa trên refresh session, không phải danh sách thiết bị. Không hiển thị mã phiên hoặc mã.</Typography>
            {self ? <Button variant="outlined" startIcon={<KeyRound size={17} />} onClick={() => setPasswordOpen(true)} disabled={!data.security.passwordSet}>Đổi mật khẩu</Button>
              : <Button variant="outlined" startIcon={<KeyRound size={17} />} onClick={() => setResetPassword(true)}>Đặt lại mật khẩu</Button>}
            {related && !self && <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button startIcon={<LockKeyhole size={17} />} color={status === 'Hoạt động' ? 'warning' : 'primary'} onClick={() => setNextStatus(status === 'Hoạt động' ? 'Đã khóa' : 'Hoạt động')} disabled={changeStatus.isPending}>
                {status === 'Hoạt động' ? 'Khóa tài khoản' : status === 'Chờ duyệt' ? 'Duyệt tài khoản' : 'Kích hoạt tài khoản'}
              </Button>
              {status === 'Chờ duyệt' && <Button color="error" onClick={() => setNextStatus('Từ chối')} disabled={changeStatus.isPending}>Từ chối</Button>}
            </Stack>}
          </Stack>
        </Panel>
        <Panel title="Thông tin hệ thống">
          <Box component="dl" sx={{ m: 0, display: 'grid', gap: 2 }}>
            <Field label="Mã tài khoản" value={user.id} />
            <Field label="Ngày tạo (UTC+7)" value={accountDisplayTime(user.createdAt)} />
            <Field label="Cập nhật gần nhất (UTC+7)" value={accountDisplayTime(user.updatedAt)} />
          </Box>
        </Panel>
      </Stack>
    </Box>}
    {tab === 'access' && <AccessPanel data={data} />}

    {related && tab === 'links' && <Panel title="Hồ sơ nghiệp vụ liên kết">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">Chỉ hiển thị hồ sơ có liên kết trực tiếp bằng mã tài khoản; không ghép theo email hoặc số điện thoại.</Typography>
        {links.isPending ? <LinearProgress /> : links.isError ? <Alert severity="error" action={<Button color="inherit" onClick={() => void links.refetch()}>Thử lại</Button>}>Không tải được hồ sơ liên kết.</Alert> : !links.data?.items.length ? <Typography color="text.secondary">Chưa có hồ sơ liên kết.</Typography> : links.data.items.map(item => <Box key={`${item.kind}-${item.id}`} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <UsersRound size={18} /><Typography sx={{ fontWeight: 700 }}>{item.name || item.id}</Typography>
            <Chip size="small" label={item.kind === 'customer' ? 'Khách hàng' : 'Cộng tác viên'} variant="outlined" />
            {item.archivedAt && <Chip size="small" label="Đã lưu trữ" />}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{item.id}</Typography>
          <Button component={RouterLink} to={item.kind === 'customer' ? '/cms/customers' : '/cms/ctv'} sx={{ mt: 0.5 }}>Đến mục quản lý {item.kind === 'customer' ? 'khách hàng' : 'cộng tác viên'}</Button>
        </Box>)}
        {links.data && <Pagination page={linksPage} total={links.data.pagination.total} onPage={setLinksPage} />}
      </Stack>
    </Panel>}

    {related && tab === 'activity' && <Panel title="Nhật ký tài khoản">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Thao tác của người dùng và các lần quản trị trực tiếp tài khoản{activity.data ? ` trong ${activity.data.retentionDays} ngày lưu trữ` : ''}. Thời gian UTC+7.</Typography>
      {activity.isPending ? <LinearProgress /> : activity.isError ? <Alert severity="error" action={<Button color="inherit" onClick={() => void activity.refetch()}>Thử lại</Button>}>Không tải được nhật ký.</Alert> : !activity.data?.items.length ? <Typography color="text.secondary">Chưa có hoạt động trong thời hạn lưu trữ.</Typography> : <>
        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
          <Table size="small" aria-label="Nhật ký tài khoản"><TableHead><TableRow><TableCell>Thời gian</TableCell><TableCell>Người thực hiện</TableCell><CmsActionsCell>Thao tác</CmsActionsCell><TableCell>Nội dung</TableCell></TableRow></TableHead>
            <TableBody>{activity.data.items.map(item => <TableRow key={item.id}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{accountDisplayTime(item.createdAt)}</TableCell>
              <TableCell><Typography variant="body2">{item.userName || 'Hệ thống'}</Typography><Typography variant="caption" color="text.secondary">{item.userEmail}</Typography></TableCell>
              <TableCell>{item.action}</TableCell><TableCell sx={{ overflowWrap: 'anywhere' }}>{item.summary}<Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{item.entityType} · {item.entityId}</Typography></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
        <Stack spacing={2} divider={<Divider />} sx={{ display: { xs: 'flex', md: 'none' } }}>{activity.data.items.map(item => <Box key={item.id}>
          <Typography variant="caption" color="text.secondary">{accountDisplayTime(item.createdAt)} · {item.action}</Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere', my: 0.5 }}>{item.summary}</Typography>
          <Typography variant="caption">{item.userName || 'Hệ thống'}</Typography>
        </Box>)}</Stack>
      </>}
      {activity.data && <Pagination page={activityPage} total={activity.data.pagination.total} onPage={setActivityPage} />}
    </Panel>}

    {!userId && user.roleCode === 'ctv_sale' && <Panel title="Không gian làm việc CTV">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button component={RouterLink} to="/cms/my-customers" startIcon={<UsersRound size={17} />}>Khách của tôi</Button>
        <Button component={RouterLink} to="/cms/commission-history" startIcon={<ShieldCheck size={17} />}>Lịch sử hoa hồng</Button>
        <Button component={RouterLink} to="/cms/sales-image">Tạo ảnh bán phòng</Button>
      </Stack>
    </Panel>}
    {roles.isError && related && <Alert severity="warning" action={<Button color="inherit" onClick={() => void roles.refetch()}>Thử lại</Button>}>Không tải được danh mục vai trò để chỉnh sửa quyền.</Alert>}
    {profileOpen && <AccountProfileDialog user={user} self={self} onClose={() => setProfileOpen(false)} />}
    {passwordOpen && self && <AccountPasswordDialog onClose={() => setPasswordOpen(false)} />}
    {adminEditor && related && roles.data && <UserEditorDialog user={user} roles={roles.data} currentUserId={String(currentUser?.id || '')} onClose={() => { setAdminEditor(false); void refresh(); }} />}
    {resetPassword && !self && <ResetUserPasswordDialog user={user} onClose={() => { setResetPassword(false); void refresh(); }} />}
    <ConfirmDialog open={nextStatus !== null} loading={changeStatus.isPending} onClose={() => setNextStatus(null)}
      title="Đổi trạng thái tài khoản?" description={`Chuyển tài khoản ${user.name} sang “${nextStatus || ''}”?`} confirmLabel="Xác nhận"
      danger={nextStatus === 'Đã khóa' || nextStatus === 'Từ chối'} onConfirm={async () => {
        if (!nextStatus || changeStatus.isPending || self) return;
        try { await changeStatus.mutateAsync({ id: user.id, status: nextStatus }); setNextStatus(null); toast.success('Đã cập nhật trạng thái.'); await refresh().catch(() => undefined); }
        catch (error) { toast.error(userErrorMessage(error)); }
      }} />
  </Stack>;
}
