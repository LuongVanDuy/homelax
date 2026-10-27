import type { AppIdentity } from './identityStore.js';
import { getCmsNavigation } from '../cms/navigation.js';

const activeStatuses = new Set(['hoạt động', 'active', 'approved', 'enabled']);

/** UI navigation gate only; Nest SecurityGuard remains the permission authority. */
export function canAccessCms(user: AppIdentity): boolean {
  if (!user) return false;
  const status = String(user.status || '').trim().toLowerCase();
  const role = String(user.roleCode || '').trim().toLowerCase();
  return activeStatuses.has(status) && role !== 'unassigned' && getCmsNavigation(user).length > 0;
}

/** Only CMS destinations can be carried through login, including legacy admin URLs. */
export function getAdminReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || Array.from(value).some((char) => char.charCodeAt(0) <= 32)) {
    return '/cms';
  }
  try {
    const url = new URL(value, 'https://tinyhouses.invalid');
    if (url.origin !== 'https://tinyhouses.invalid') return '/cms';
    let path = url.pathname;
    if (path === '/admin' || path.startsWith('/admin/')) {
      path = `/cms${path.slice('/admin'.length)}`;
    }
    if (path !== '/cms' && !path.startsWith('/cms/')) return '/cms';
    // Encoded delimiters and dot segments must not turn a destination into another route.
    if (/%(?:2f|5c|2e|25)/i.test(path) || /^\/cms\/login(?:\/|$)/i.test(path)) return '/cms';
    return `${path}${url.search}${url.hash}`;
  } catch {
    return '/cms';
  }
}

export function getAdminLoginUrl(returnTo: string): string {
  return `/admin/login?returnTo=${encodeURIComponent(getAdminReturnTo(returnTo))}`;
}
