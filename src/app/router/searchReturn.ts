import { publicHref } from './publicNavigation';
import { routePaths } from './routePaths';

/** Keep the originating search in this history entry, not in shared detail URLs. */
export function searchReturnState(location: { pathname: string; search: string; hash: string }) {
  return location.pathname === routePaths.search
    ? { searchReturnTo: `${location.pathname}${location.search}${location.hash}` }
    : undefined;
}

export function searchReturnHref(state: unknown, currentSearch: string) {
  const fallback = publicHref(routePaths.search, currentSearch);
  if (!state || typeof state !== 'object' || !('searchReturnTo' in state)) return fallback;
  const target = state.searchReturnTo;
  if (typeof target !== 'string' || !/^\/tim-phong(?:\?|#|$)/.test(target)) return fallback;
  const url = new URL(target, 'https://tinyhouses.invalid');
  if (url.origin !== 'https://tinyhouses.invalid' || url.pathname !== routePaths.search) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
