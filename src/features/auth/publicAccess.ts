import type { AppIdentity } from './identityStore.js';
import { canAccessCms } from './adminAccess.js';
import { legacyPublicTarget, policyPages, regionalSearchLinks } from '../../app/router/publicDestinations.js';

/** Public destinations only; never allow login loops, external URLs or CMS escalation. */
export function getPublicReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')
      || Array.from(value).some(char => char.charCodeAt(0) <= 32)) return null;
  try {
    const original = new URL(value, 'https://tinyhouses.invalid');
    const url = new URL(legacyPublicTarget(original.pathname, original.search, original.hash) || value, 'https://tinyhouses.invalid');
    if (url.origin !== 'https://tinyhouses.invalid') return null;
    if (/%(?:2f|5c|2e|25|0[0-9a-f]|1[0-9a-f])/i.test(url.pathname)) return null;
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    const publicPage = ['/', '/tim-phong', '/chu-nha', '/cong-tac-vien', '/ve-chung-toi', '/tin-tuc', '/lien-he', '/tai-khoan', '/tai-khoan/yeu-thich', '/tai-khoan/lich-xem-phong', '/tai-khoan/phong-da-thue', ...Object.keys(policyPages), ...regionalSearchLinks.map(link => link.path), '/thue-gan-truong-dai-hoc', '/gioi-thieu', '/phan-anh'].includes(path)
      || /^\/(?:phong|toa-nha|tin-tuc)\/[^/\\\s]+$/.test(path);
    return publicPage ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function getPublicLoginUrl(returnTo: string) {
  const destination = getPublicReturnTo(returnTo);
  return destination ? `/dang-nhap?returnTo=${encodeURIComponent(destination)}` : '/dang-nhap';
}

export function getPublicLoginDestination(user: AppIdentity, search: string) {
  const params = new URLSearchParams(search);
  if (params.has('returnTo')) return getPublicReturnTo(params.get('returnTo')) || '/';
  if (user?.roleCode === 'ctv_sale' && canAccessCms(user)) return '/cms/my-customers';
  const ref = params.get('ref');
  return ref ? `/?${new URLSearchParams({ ref })}` : '/';
}
