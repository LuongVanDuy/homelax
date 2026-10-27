import type { AppIdentity } from '../auth/identityStore';

export function isOwnAccountPath(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/cms/account';
}

/** Account access does not grant any CMS business screen. Pending/locked identities stay denied. */
export function canAccessOwnAccount(user: AppIdentity) {
  return Boolean(user?.id) && ['hoạt động', 'active', 'approved', 'enabled'].includes(
    String(user?.status || '').trim().toLowerCase(),
  );
}

export function userDetailIdFromPath(pathname: string): string | null {
  const match = pathname.replace(/\/+$/, '').match(/^\/cms\/users\/([^/]+)$/);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]);
    return id && !id.includes('/') && !id.includes('\\') && !Array.from(id).some(character => character.charCodeAt(0) < 32) ? id : null;
  } catch { return null; }
}
