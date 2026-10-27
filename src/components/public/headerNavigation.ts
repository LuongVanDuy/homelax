export const publicHeaderLinks = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Về chúng tôi', to: '/ve-chung-toi' },
  { label: 'Tìm phòng', to: '/tim-phong' },
] as const;

export const publicHeaderGroups = [
  { id: 'cooperate', label: 'Hợp tác', links: [
    { label: 'Chủ nhà', to: '/chu-nha' },
    { label: 'CTV sale phòng', to: '/cong-tac-vien' },
  ] },
  { id: 'news', label: 'Tin tức', links: [
    { label: 'Tất cả tin tức', to: '/tin-tuc' },
  ] },
] as const;

export function isPublicHeaderLinkActive(to: string, pathname: string, search: string) {
  const target = new URL(to, 'https://tinyhouses.invalid');
  const path = pathname.replace(/\/+$/, '') || '/';
  if (target.pathname === '/tim-phong') return path === '/tim-phong' || /^\/(toa-nha|phong)\/[^/]+$/.test(path);
  if (target.pathname !== path) return false;
  if (path === '/tin-tuc') {
    const rawCategory = new URLSearchParams(search).get('category');
    const category = rawCategory || '';
    return category === (target.searchParams.get('category') || '');
  }
  return true;
}

export function publicHeaderGroupsWithCategories(categories: readonly { name: string; slug: string }[]) {
  return publicHeaderGroups.map(group => group.id === 'news' ? { ...group, links: [
    { label: 'Tất cả tin tức', to: '/tin-tuc' },
    ...categories.map(category => ({ label: category.name, to: `/tin-tuc?category=${category.slug}` })),
  ] } : group);
}
