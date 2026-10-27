import { Typography } from '@mui/material';
import { Navigate, useLocation } from 'react-router';
import { canAccessCms, getAdminReturnTo } from '../adminAccess';
import type { AppIdentity } from '../identityStore';
import { AuthShell } from '../components/AuthShell';
import { AdminLoginForm } from '../components/AdminLoginForm';
import { AdminAccessDenied } from '../components/AdminAccessDenied';
import { canAccessOwnAccount, isOwnAccountPath } from '../../account/accountRoutes';

export function AdminLoginPage({ user, onLogout }: { user: AppIdentity; onLogout: () => Promise<void> }) {
  const location = useLocation();
  const returnTo = getAdminReturnTo(new URLSearchParams(location.search).get('returnTo'));
  if (user) {
    const selfProfile = isOwnAccountPath(returnTo.split('?')[0].split('#')[0]) && canAccessOwnAccount(user);
    return (canAccessCms(user) || selfProfile) ? <Navigate to={returnTo} replace /> : <AdminAccessDenied user={user} onLogout={onLogout} />;
  }
  return (
    <AuthShell>
      <Typography component="h1" variant="h4" sx={{ fontSize: { xs: 28, sm: 32 }, letterSpacing: '-0.025em', mb: 1.5 }}>
        Đăng nhập quản trị
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
        Chào mừng bạn trở lại.<br />Sử dụng tài khoản được cấp để tiếp tục.
      </Typography>
      <AdminLoginForm />
    </AuthShell>
  );
}
