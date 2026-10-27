import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { AppIdentity } from '../auth/identityStore';
import { cmsNavigation, getCmsNavigation } from './navigation';
import { canAccessOwnAccount, isOwnAccountPath } from '../account/accountRoutes';
import { normalizeCmsPath } from './cmsRoutes';

export function useCmsNavigation(user: AppIdentity) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useMemo(() => getCmsNavigation(user), [user]);
  const path = location.pathname.replace(/\/+$/, '') || '/cms';
  const normalizedPath = normalizeCmsPath(path);
  const isIndex = normalizedPath === '/cms';
  const exactRequested = cmsNavigation.find((item) =>
    item.path === normalizedPath || (item.code === 'dashboard' && normalizedPath === '/cms/dashboard')
  );
  const nestedRequested = cmsNavigation
    .filter((item) => item.path !== '/cms' && normalizedPath.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const requested = exactRequested || nestedRequested;
  const selected = isIndex ? navigation.find((item) => item.code === 'dashboard') || navigation[0] : navigation.find((item) => item.code === requested?.code);

  useEffect(() => {
    if (path !== normalizedPath) {
      navigate(`${normalizedPath}${location.search}${location.hash}`, { replace: true });
      return;
    }
    if (isIndex && selected && selected.path !== '/cms') {
      navigate(`${selected.path}${location.search}${location.hash}`, { replace: true });
    }
  }, [path, normalizedPath, isIndex, selected, navigate, location.search, location.hash]);

  return {
    navigation,
    activeSection: isOwnAccountPath(normalizedPath) && canAccessOwnAccount(user) ? 'account' : selected?.code || '',
    normalizedPath,
    unavailableReason: !requested ? 'not-found' : 'forbidden',
  };
}
