import { policyPages } from './publicDestinations';
import { generatePath } from 'react-router';

export type LegacyTab =
  | 'not-found'
  | 'home'
  | 'search'
  | 'building-detail'
  | 'room-detail'
  | 'landlord'
  | 'partner'
  | 'about'
  | 'contact'
  | 'blog'
  | 'blog-detail'
  | 'login'
  | 'cms';

export const routePaths = {
  home: '/',
  search: '/tim-phong',
  building: '/toa-nha/:buildingId',
  room: '/phong/:roomId',
  landlord: '/chu-nha',
  partner: '/cong-tac-vien',
  about: '/ve-chung-toi',
  contact: '/lien-he',
  blog: '/tin-tuc',
  blogDetail: '/tin-tuc/:blogId',
  login: '/admin/login',
  publicLogin: '/dang-nhap',
  register: '/dang-ky',
  account: '/tai-khoan',
  accountFavorites: '/tai-khoan/yeu-thich',
  accountBookings: '/tai-khoan/lich-xem-phong',
  accountRentals: '/tai-khoan/phong-da-thue',
  forgotPassword: '/quen-mat-khau',
  resetPassword: '/dat-lai-mat-khau',
  verifyEmail: '/xac-thuc-email',
  cms: '/cms',
} as const;

export const routeAliases = {
  admin: '/admin',
  authLogin: '/auth/login',
} as const;

export const routeHref = {
  building: (buildingId: string) =>
    generatePath(routePaths.building, { buildingId }),
  room: (roomId: string) => generatePath(routePaths.room, { roomId }),
  blog: (blogId: string) => generatePath(routePaths.blogDetail, { blogId }),
};

export function pathnameToTab(pathname: string): LegacyTab {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (/^\/toa-nha\/[^/]+$/.test(path)) return 'building-detail';
  if (/^\/phong\/[^/]+$/.test(path)) return 'room-detail';
  if (/^\/tin-tuc\/[^/]+$/.test(path)) return 'blog-detail';
  if (path === '/tim-phong') return 'search';
  if (path === '/chu-nha') return 'landlord';
  if (path === '/cong-tac-vien' || path === '/ctv') return 'partner';
  if (path === '/ve-chung-toi') return 'about';
  if (path === '/lien-he') return 'contact';
  if (path === '/tin-tuc') return 'blog';
  if (path === '/dang-nhap' || path === '/admin/login' || path === '/auth/login') return 'login';
  if (path === '/cms' || path.startsWith('/cms/') || path === '/admin' || path.startsWith('/admin/')) return 'cms';
  return path === '/' ? 'home' : 'not-found';
}

export function getDocumentTitle(pathname: string) {
  if (policyPages[pathname]) return `${policyPages[pathname]} - Homelax`;
  if (pathname === '/tai-khoan' || pathname.startsWith('/tai-khoan/')) return 'Tài khoản của tôi - Homelax';
  if (pathname === '/quen-mat-khau') return 'Quên mật khẩu - Homelax';
  if (pathname === '/dat-lai-mat-khau') return 'Đặt lại mật khẩu - Homelax';
  if (pathname === '/xac-thuc-email') return 'Xác thực email - Homelax';
  if (pathname === '/dang-ky') return 'Đăng ký - Homelax';
  if (pathname === '/dang-nhap' || pathname === '/auth/login') return 'Đăng nhập - Homelax';
  const tab = pathnameToTab(pathname);
  if (tab === 'building-detail') {
    let id = pathname.split('/toa-nha/')[1] || '';
    try { id = decodeURIComponent(id); } catch { /* Keep malformed paths readable. */ }
    return `Chi tiết tòa nhà ${id} - Homelax`;
  }

  const titles: Record<LegacyTab, string> = {
    'not-found': 'Trang không khả dụng - Homelax',
    home: 'Homelax - Quản lý vận hành phòng trọ/ccmn tại Hà Nội',
    login: 'Đăng nhập hệ thống - Homelax',
    search: 'Tìm phòng trọ & Căn hộ - Homelax',
    'building-detail': 'Chi tiết tòa nhà - Homelax',
    'room-detail': 'Chi tiết căn hộ - Homelax',
    landlord: 'Dành cho chủ nhà - Homelax',
    partner: 'Hợp tác CTV & Môi giới - Homelax',
    about: 'Về chúng tôi - Homelax',
    contact: 'Liên hệ - Homelax',
    blog: 'Tin tức & Cẩm nang - Homelax',
    'blog-detail': 'Tin tức & Cẩm nang - Homelax',
    cms: 'Hệ thống Quản trị - Homelax',
  };
  return titles[tab];
}

