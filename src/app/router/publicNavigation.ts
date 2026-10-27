const base = 'https://tinyhouses.invalid';

/** Carry only the current referral across pages; retain the target's own query/hash. */
export function publicHref(target: string, currentSearch = '') {
  if (!target.startsWith('/') || target.startsWith('//') || /^\/(?:cms|admin|login|auth|dang-nhap|dang-ky|quen-mat-khau|dat-lai-mat-khau)(?:\/|\?|#|$)/i.test(target)) return target;
  const url = new URL(target, base);
  const ref = new URLSearchParams(currentSearch).get('ref');
  if (!url.searchParams.has('ref') && ref) url.searchParams.set('ref', ref);
  return `${url.pathname}${url.search}${url.hash}`;
}

const hashRoutes: Record<string, string> = {
  home: '/', search: '/tim-phong', landlord: '/chu-nha', partner: '/cong-tac-vien',
  about: '/ve-chung-toi', blog: '/tin-tuc',
};

export function legacyHashTarget(pathname: string, search: string, hash: string) {
  if (pathname !== '/') return null;
  const [name, query = ''] = hash.slice(1).split('?');
  const path = hashRoutes[name];
  if (!path) return null;
  const params = new URLSearchParams(search);
  new URLSearchParams(query).forEach((value, key) => params.set(key, value));
  return `${path}${params.size ? `?${params}` : ''}`;
}
