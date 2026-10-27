import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { patchPublicSearch, readPublicSearch, type PublicSearch } from './publicSearch';

export function usePublicSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = useMemo(() => readPublicSearch(location.search), [location.search]);
  const update = useCallback((patch: Partial<PublicSearch>, replace = false) => {
    navigate({ pathname: location.pathname, search: patchPublicSearch(location.search, patch), hash: location.hash }, { replace, preventScrollReset: true });
  }, [navigate, location.pathname, location.search, location.hash]);
  return [state, update] as const;
}
