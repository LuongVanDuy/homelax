import { PublicLink } from '../../../app/router/PublicLink';
import { Alert, Box, Button, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router';
import { PublicContainer, PublicSurface } from '../../../components/public';
import type { AppIdentity } from '../../auth/identityStore';
import { getPublicLoginUrl } from '../../auth/publicAccess';

export function PublicAccountLayout({ user, sessionReady, sessionError, onRetry }: {
  user: AppIdentity; sessionReady: boolean; sessionError: boolean; onRetry: () => void;
}) {
  const location = useLocation();
  const tabs = [
    ['/tai-khoan', 'Hồ sơ cá nhân'],
    ['/tai-khoan/yeu-thich', 'Căn yêu thích'],
    ['/tai-khoan/lich-xem-phong', 'Lịch xem phòng'],
    ['/tai-khoan/phong-da-thue', 'Phòng đã thuê'],
  ];
  if (sessionReady && !sessionError && !user) return <Navigate to={getPublicLoginUrl(`${location.pathname}${location.search}`)} replace />;
  return <PublicSurface><PublicContainer>
    <Stack spacing={3} sx={{ py: { xs: 3, md: 5 }, minHeight: '50vh' }}>
      <Typography component="h1" variant="h4" sx={{ fontWeight: 800 }}>Tài khoản của tôi</Typography>
      {!sessionReady ? <Skeleton height={180} variant="rounded" /> : sessionError ? <Alert severity="warning"
        action={<Button color="inherit" onClick={onRetry}>Thử lại</Button>}>Chưa thể kiểm tra phiên đăng nhập.</Alert> : user && <>
        <Tabs value={tabs.some(([to]) => to === location.pathname) ? location.pathname : '/tai-khoan'} variant="scrollable" scrollButtons="auto" aria-label="Tài khoản cá nhân">
          {tabs.map(([to, label]) => <Tab key={to} value={to} label={label} component={PublicLink} to={to} />)}
        </Tabs>
        <Box key={user.id}><Outlet context={{ currentUser: user }} /></Box>
      </>}
    </Stack>
  </PublicContainer></PublicSurface>;
}
