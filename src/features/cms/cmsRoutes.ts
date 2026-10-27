const CMS_PATH_ALIASES: Readonly<Record<string, string>> = {
  '/cms/rooms/amenities': '/cms/amenities/rooms',
};

function trimCmsPath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/cms';
}

export function normalizeCmsPath(pathname: string) {
  const path = trimCmsPath(pathname);
  return CMS_PATH_ALIASES[path] || path;
}

function safeDecodeRouteSegment(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      Array.from(decoded).some((character) => character.charCodeAt(0) < 32)
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export type CmsEditorRoute =
  | { mode: 'list' }
  | { mode: 'create' }
  | { mode: 'edit'; id: string }
  | { mode: 'invalid' };

export function matchCmsEditorRoute(
  pathname: string,
  basePath: '/cms/buildings' | '/cms/rooms' | '/cms/blog',
): CmsEditorRoute {
  const path = normalizeCmsPath(pathname);
  if (path === basePath) return { mode: 'list' };
  if (path === `${basePath}/new`) return { mode: 'create' };
  if (!path.startsWith(`${basePath}/`)) return { mode: 'invalid' };

  const suffix = path.slice(basePath.length + 1);
  const match = suffix.match(/^([^/]+)\/edit$/);
  if (!match) return { mode: 'invalid' };
  const id = safeDecodeRouteSegment(match[1]);
  return id ? { mode: 'edit', id } : { mode: 'invalid' };
}

export function isExactCmsPath(pathname: string, expected: string) {
  return normalizeCmsPath(pathname) === expected;
}
