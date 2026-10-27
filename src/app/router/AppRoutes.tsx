import { PublicFavoritesPage } from '../../features/account/pages/PublicFavoritesPage';
import { PublicBookingsPage } from '../../features/account/pages/PublicBookingsPage';
import { PublicRentalsPage } from '../../features/account/pages/PublicRentalsPage';
import { lazy, Suspense, useCallback, useEffect } from 'react';
import { LoadingState } from '../../components/ui/feedback/LoadingState';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router';
import { legacyHashTarget } from './publicNavigation';
import { legacyPublicTarget, policyPages, regionalSearchLinks } from './publicDestinations';
import { PublicPolicyPage } from '../../features/content/PublicPolicyPage';
import { PublicRouteState } from './PublicRouteState';
import { PublicBlogDetailPage } from '../../features/blog/PublicBlogDetailPage';
import { AuthService } from '../../features/auth';
import type { AppIdentity } from '../../features/auth/identityStore';
import { toast } from '../../lib/toast';
import { useAuthSession } from '../../features/auth/useAuthSession';
import { AdminLoginPage } from '../../features/auth/pages/AdminLoginPage';
import { PublicLoginPage } from '../../features/auth/pages/PublicLoginPage';
import { PasswordRecoveryPage } from '../../features/auth/pages/PasswordRecoveryPage';
import { EmailVerificationPage } from '../../features/auth/pages/EmailVerificationPage';
import { PublicAccountLayout } from '../../features/account/pages/PublicAccountLayout';
import { PublicProfilePage } from '../../features/account/pages/PublicProfilePage';
import { AdminRouteGuard } from '../../features/auth/components/AdminRouteGuard';
import { getAdminLoginUrl, getAdminReturnTo } from '../../features/auth/adminAccess';
import HomePage from '../../features/home/pages/HomePage';
import SearchPage from '../../features/discovery/pages/SearchPage';
import PublicBuildingDetailPage from '../../features/buildings/pages/PublicBuildingDetailPage';
import PublicRoomDetailPage from '../../features/rooms/pages/PublicRoomDetailPage';
import LandlordPage from '../../features/landlord/pages/LandlordPage';
import PartnerPage from '../../features/partner/pages/PartnerPage';
import AboutPage from '../../features/about/pages/AboutPage';
import ContactPage from '../../features/contact/pages/ContactPage';
import { PublicBlogPage as BlogPage } from '../../features/blog/PublicBlogPage';
import { PublicLayout } from '../../layouts/public';
import { AdminLayout } from '../../layouts/admin';
import {
  getDocumentTitle,
  routeAliases,
  routePaths,
} from './routePaths';

const CMSLayout = lazy(() => import('../../pages/cms/CMSLayout')); 

function BuildingRoute({ currentUser }: { currentUser: AppIdentity }) {
  const { buildingId = '' } = useParams();
  return <PublicBuildingDetailPage buildingId={buildingId} currentUser={currentUser} />;
}

function RoomRoute({
  currentUser,
}: {
  currentUser: AppIdentity;
}) {
  const { roomId = '' } = useParams();
  return <PublicRoomDetailPage key={roomId} roomId={roomId} currentUser={currentUser} />;
}

function PublicLoginAliasRedirect() {
  const location = useLocation();
  return <Navigate to={`${routePaths.publicLogin}${location.search}${location.hash}`} replace />;
}

function LegacyAdminRedirect() {
  const location = useLocation();
  return <Navigate to={getAdminReturnTo(`${location.pathname}${location.search}${location.hash}`)} replace />;
}

function PublicAliasRedirect({ to }: { to: string }) {
  const location = useLocation();
  const target = new URL(to, 'https://tinyhouses.invalid');
  const query = new URLSearchParams(location.search);
  target.searchParams.forEach((value, key) => query.set(key, value));
  return <Navigate to={`${target.pathname}${query.size ? `?${query}` : ''}${location.hash}`} replace />;
}



export function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, sessionReady, sessionError, retrySession } = useAuthSession();
  useEffect(() => {
    document.title = getDocumentTitle(location.pathname);
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    try {
      await AuthService.logout();
      toast.success('Đã đăng xuất.', { id: 'auth-session' });
    } catch {
      toast.warning('Đã xóa phiên trên trình duyệt, nhưng chưa thể xác nhận đăng xuất với máy chủ. Vui lòng kiểm tra kết nối.', { id: 'auth-session', duration: 8000 });
    }
  }, []);

  const handleAdminLogout = useCallback(async () => {
    const returnTo = getAdminReturnTo(
      new URLSearchParams(location.search).get('returnTo') || `${location.pathname}${location.search}${location.hash}`,
    );
    await handleLogout();
    navigate(returnTo === routePaths.cms ? routePaths.login : getAdminLoginUrl(returnTo), { replace: true });
  }, [handleLogout, navigate, location.pathname, location.search, location.hash]);

  const legacyTarget = legacyPublicTarget(location.pathname, location.search, location.hash);
  if (legacyTarget) return <Navigate to={legacyTarget} replace />;

  const hashTarget = legacyHashTarget(location.pathname, location.search, location.hash);
  if (hashTarget) return <Navigate to={hashTarget} replace />;

  return (
    <>
      <Routes>
        <Route
          element={
            <PublicLayout
              sessionReady={sessionReady}
              sessionError={sessionError}
              onRetrySession={retrySession}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          }
        >
          <Route path={routePaths.register} element={<PublicLoginPage registration
            user={currentUser} sessionReady={sessionReady} sessionError={sessionError} onRetry={retrySession}
          />} />
          <Route path={routePaths.forgotPassword} element={<PasswordRecoveryPage key="forgot" />} />
          <Route path={routePaths.account} element={<PublicAccountLayout user={currentUser} sessionReady={sessionReady} sessionError={sessionError} onRetry={retrySession} />}>
            <Route index element={<PublicProfilePage />} />
            <Route path="yeu-thich" element={<PublicFavoritesPage />} />
            <Route path="lich-xem-phong" element={<PublicBookingsPage />} />
            <Route path="phong-da-thue" element={<PublicRentalsPage />} />
          </Route>
          <Route path={routePaths.resetPassword} element={<PasswordRecoveryPage key="reset" reset />} />
          <Route path={routePaths.verifyEmail} element={<EmailVerificationPage />} />
          <Route path={routePaths.publicLogin} element={<PublicLoginPage
            user={currentUser} sessionReady={sessionReady} sessionError={sessionError} onRetry={retrySession}
          />} />
          <Route
            path={routePaths.home}
            element={
              <HomePage />
            }
          />
          <Route
            path={routePaths.search}
            element={
              <SearchPage />
            }
          />
          <Route
            path={routePaths.building}
            element={
              <BuildingRoute currentUser={currentUser} />
            }
          />
          <Route path={routePaths.room} element={<RoomRoute currentUser={currentUser} />} />
          <Route path={routePaths.landlord} element={<LandlordPage />} />
          <Route path={routePaths.partner} element={<PartnerPage currentUser={sessionReady && !sessionError ? currentUser : null} />} />
          <Route path={routePaths.about} element={<AboutPage />} />
          <Route path={routePaths.contact} element={<ContactPage />} />
          <Route
            path={routePaths.blog}
            element={
              <BlogPage />
            }
          />
          <Route path={routePaths.blogDetail} element={<PublicBlogDetailPage />} />
          {Object.entries(policyPages).map(([path,title]) => <Route key={path} path={path} element={<PublicPolicyPage title={title} />} />)}
          {regionalSearchLinks.map(link => <Route key={link.path} path={link.path} element={<PublicAliasRedirect to={link.to} />} />)}
          <Route path="/thue-gan-truong-dai-hoc" element={<PublicAliasRedirect to="/tim-phong?nearSchool=any" />} />
          <Route path="*" element={<PublicRouteState />} />
        </Route>

        <Route element={<AdminLayout sessionReady={sessionReady} sessionError={sessionError} onRetry={retrySession} />}>
          <Route
            path={routePaths.login}
            element={
              <AdminLoginPage user={currentUser} onLogout={handleAdminLogout} />
            }
          />
          <Route element={<AdminRouteGuard user={currentUser} onLogout={handleAdminLogout} />}>
            <Route
              path={`${routePaths.cms}/*`}
              element={
                <Suspense fallback={<LoadingState />}><CMSLayout
                  currentUser={currentUser}
                  onLogout={handleAdminLogout}
                /></Suspense>
              }
            />
          </Route>
        </Route>

        <Route path={routeAliases.authLogin} element={<PublicLoginAliasRedirect />} />
        <Route path={`${routeAliases.admin}/*`} element={<LegacyAdminRedirect />} />
        <Route path="/gioi-thieu" element={<PublicAliasRedirect to="/cong-tac-vien" />} />
        <Route path="/phan-anh" element={<PublicAliasRedirect to="/lien-he" />} />
      </Routes>

    </>
  );
}
