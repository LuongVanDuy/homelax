import { Navigate, Outlet, useLocation } from 'react-router';
import { canAccessCms, getAdminLoginUrl } from '../adminAccess';
import type { AppIdentity } from '../identityStore';
import { AdminAccessDenied } from './AdminAccessDenied';
import { canAccessOwnAccount, isOwnAccountPath } from '../../account/accountRoutes';

export function AdminRouteGuard({ user, onLogout }: { user: AppIdentity; onLogout: () => Promise<void> }) {
  const location = useLocation();
  if (!user) return <Navigate replace to={getAdminLoginUrl(`${location.pathname}${location.search}${location.hash}`)} />;
  if (!(isOwnAccountPath(location.pathname) && canAccessOwnAccount(user)) && !canAccessCms(user)) return <AdminAccessDenied user={user} onLogout={onLogout} />;
  return <Outlet />;
}
