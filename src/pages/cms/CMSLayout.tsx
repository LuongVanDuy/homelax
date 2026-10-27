import { BlogPostEditorPage } from '../../features/blog/BlogPostEditorPage';
import { BlogAdminPage } from '../../features/blog/BlogAdminPage';
import { IntakePage } from '../../features/intake/IntakePage';
import type { ReactNode } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { AppIdentity } from '../../features/auth/identityStore';
import { getIdentityScope } from '../../features/auth/identityStore';
import { useCmsNavigation } from '../../features/cms/useCmsNavigation';
import { isExactCmsPath, matchCmsEditorRoute } from '../../features/cms/cmsRoutes';
import type { CmsNavigationItem } from '../../layouts/admin/CmsShell';
import { CmsShell } from '../../layouts/admin/CmsShell';
import { AccountPage } from '../../features/account/pages/AccountPage';
import { userDetailIdFromPath } from '../../features/account/accountRoutes';
import { AmenitiesPage } from '../../features/amenities/pages/AmenitiesPage';
import { AuditLogPage } from '../../features/audit/pages/AuditLogPage';
import { MyCustomersPage } from '../../features/affiliate/pages/MyCustomersPage';
import { SalesImagePage } from '../../features/affiliate/pages/SalesImagePage';
import { BookingsPage } from '../../features/bookings/pages/BookingsPage';
import { BuildingEditorPage } from '../../features/buildings/pages/BuildingEditorPage';
import { BuildingsPage } from '../../features/buildings/pages/BuildingsPage';
import { CollaboratorsPage } from '../../features/contacts/pages/CollaboratorsPage';
import { CustomersPage } from '../../features/contacts/pages/CustomersPage';
import { DashboardPage } from '../../features/dashboard/pages/DashboardPage';
import { DatabaseAdminPage } from '../../features/database-admin/pages/DatabaseAdminPage';
import { DealsPage } from '../../features/deals/pages/DealsPage';
import { CommissionConfigPage } from '../../features/commission-config/pages/CommissionConfigPage';
import { CommissionHistoryPage } from '../../features/commission-ledger/pages/CommissionHistoryPage';
import { RolesPage } from '../../features/roles/pages/RolesPage';
import { RoomEditorPage } from '../../features/rooms/pages/RoomEditorPage';
import { RoomsPage } from '../../features/rooms/pages/RoomsPage';
import { RoomTypesCatalogPage } from '../../features/room-types/pages/RoomTypesCatalogPage';
import { SchoolsPage } from '../../features/schools/pages/SchoolsPage';
import { UsersPage } from '../../features/users/pages/UsersPage';

type CMSLayoutProps = {
  currentUser: AppIdentity;
  onLogout: () => Promise<void>;
};

type UnavailableReason = 'not-found' | 'forbidden';

function CmsUnavailableState({
  reason,
  navigation,
  onNavigate,
}: {
  reason: UnavailableReason;
  navigation: CmsNavigationItem[];
  onNavigate: (path: string) => void;
}) {
  const fallback = navigation[0];
  return (
    <Stack spacing={2} sx={{ py: 6, alignItems: 'flex-start' }}>
      <ShieldAlert size={32} aria-hidden="true" />
      <Typography component="h1" variant="h5">
        {reason === 'not-found' ? 'Không tìm thấy trang' : 'Bạn chưa có quyền xem trang này'}
      </Typography>
      <Typography color="text.secondary">
        Chọn một mục trong menu để tiếp tục làm việc.
      </Typography>
      {fallback && (
        <Button
          variant="contained"
          color="secondary"
          onClick={() => onNavigate(fallback.path)}
        >
          Về {fallback.label.toLowerCase()}
        </Button>
      )}
    </Stack>
  );
}

function renderCmsPage({
  activeSection,
  pathname,
  currentUser,
  identityScope,
}: {
  activeSection: string;
  pathname: string;
  currentUser: AppIdentity;
  identityScope: string | null;
}): ReactNode {
  switch (activeSection) {
    case 'dashboard':
      return isExactCmsPath(pathname, '/cms') || isExactCmsPath(pathname, '/cms/dashboard')
        ? <DashboardPage currentUser={currentUser} />
        : null;

    case 'buildings': {
      const route = matchCmsEditorRoute(pathname, '/cms/buildings');
      if (route.mode === 'list') return <BuildingsPage currentUser={currentUser} />;
      if (route.mode === 'create') return <BuildingEditorPage />;
      if (route.mode === 'edit') return <BuildingEditorPage buildingId={route.id} />;
      return null;
    }

    case 'buildingAmenities':
      return isExactCmsPath(pathname, '/cms/amenities/buildings')
        ? <AmenitiesPage key="building-amenities" fixedScope="building" />
        : null;

    case 'schools':
      return isExactCmsPath(pathname, '/cms/schools') ? <SchoolsPage /> : null;

    case 'rooms': {
      const route = matchCmsEditorRoute(pathname, '/cms/rooms');
      if (route.mode === 'list') return <RoomsPage currentUser={currentUser} />;
      if (route.mode === 'create') return <RoomEditorPage />;
      if (route.mode === 'edit') return <RoomEditorPage roomTypeId={route.id} />;
      return null;
    }

    case 'roomTypeCatalog':
      return isExactCmsPath(pathname, '/cms/room-types') ? <RoomTypesCatalogPage /> : null;

    case 'roomAmenities':
      return isExactCmsPath(pathname, '/cms/amenities/rooms')
        ? <AmenitiesPage key="room-amenities" fixedScope="room" />
        : null;

    case 'bookings':
      return isExactCmsPath(pathname, '/cms/bookings')
        ? <BookingsPage currentUser={currentUser} />
        : null;

    case 'deals':
      return isExactCmsPath(pathname, '/cms/deals')
        ? <DealsPage currentUser={currentUser} />
        : null;

    case 'blog': {
      const route = matchCmsEditorRoute(pathname, '/cms/blog');
      if (route.mode === 'list') return <BlogAdminPage key={identityScope} />;
      if (route.mode === 'create') return <BlogPostEditorPage key={`${identityScope}:new`} />;
      if (route.mode === 'edit') return <BlogPostEditorPage key={`${identityScope}:${route.id}`} postId={route.id} />;
      return null;
    }

    case 'intake':
      return isExactCmsPath(pathname, '/cms/intake') ? <IntakePage key={identityScope} /> : null;

    case 'customers':
      return isExactCmsPath(pathname, '/cms/customers')
        ? <CustomersPage currentUser={currentUser} />
        : null;

    case 'ctv':
      return isExactCmsPath(pathname, '/cms/ctv')
        ? <CollaboratorsPage currentUser={currentUser} />
        : null;

    case 'commissionConfig':
      return isExactCmsPath(pathname, '/cms/commission-config')
        ? <CommissionConfigPage />
        : null;

    case 'myCustomers':
      return isExactCmsPath(pathname, '/cms/my-customers')
        ? <MyCustomersPage currentUser={currentUser} />
        : null;

    case 'salesImage':
      return isExactCmsPath(pathname, '/cms/sales-image')
        ? <SalesImagePage currentUser={currentUser} />
        : null;

    case 'commissionHistory':
      return isExactCmsPath(pathname, '/cms/commission-history')
        ? <CommissionHistoryPage currentUser={currentUser} />
        : null;

    case 'account':
      return isExactCmsPath(pathname, '/cms/account')
        ? <AccountPage key={identityScope} currentUser={currentUser} />
        : null;

    case 'users': {
      if (isExactCmsPath(pathname, '/cms/users')) {
        return <UsersPage currentUser={currentUser} />;
      }
      const userId = userDetailIdFromPath(pathname);
      return userId
        ? <AccountPage key={`${identityScope}:${userId}`} userId={userId} currentUser={currentUser} />
        : null;
    }

    case 'permissions':
      return isExactCmsPath(pathname, '/cms/permissions')
        ? <RolesPage currentUser={currentUser} />
        : null;

    case 'database':
      return isExactCmsPath(pathname, '/cms/database')
        ? <DatabaseAdminPage key={identityScope} currentUser={currentUser} />
        : null;

    case 'auditlog':
      return isExactCmsPath(pathname, '/cms/auditlog')
        ? <AuditLogPage key={identityScope} currentUser={currentUser} />
        : null;

    default:
      return null;
  }
}

export default function CMSLayout({ currentUser, onLogout }: CMSLayoutProps) {
  const navigate = useNavigate();
  const { navigation, activeSection, normalizedPath, unavailableReason } =
    useCmsNavigation(currentUser);
  const identityScope = getIdentityScope(currentUser);
  const content = activeSection
    ? renderCmsPage({
        activeSection,
        pathname: normalizedPath,
        currentUser,
        identityScope,
      })
    : null;
  const shellUser = currentUser || {
    name: 'Unknown',
    roleCode: 'unassigned',
    roleName: 'Chưa phân quyền',
    allowedScreens: [],
  };
  const reason: UnavailableReason = activeSection && !content
    ? 'not-found'
    : unavailableReason === 'not-found' ? 'not-found' : 'forbidden';

  return (
    <CmsShell
      user={shellUser}
      navigation={navigation}
      activeSection={activeSection}
      onProfile={() => navigate('/cms/account')}
      onLogout={onLogout}
    >
      {content || (
        <CmsUnavailableState
          reason={reason}
          navigation={navigation}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </CmsShell>
  );
}
