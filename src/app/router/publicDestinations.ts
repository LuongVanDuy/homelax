/** Public destinations shared by routing, footer and safe authentication returns. */
export const policyPages: Record<string, string> = {
  '/dieu-khoan': 'Điều khoản sử dụng',
  '/chinh-sach-bao-mat': 'Chính sách bảo mật',
  '/quy-che-tmdt': 'Quy chế hoạt động TMĐT',
  '/giai-quyet-tranh-chap': 'Cơ chế giải quyết tranh chấp',
};

export const regionalSearchLinks = [
  ['thanh-xuan', 'Thanh Xuân'], ['cau-giay', 'Cầu Giấy'], ['ha-dong', 'Hà Đông'],
  ['tay-ho', 'Tây Hồ'], ['hoang-mai', 'Hoàng Mai'],
].map(([slug, name]) => ({
  path: `/phong-tro-${slug}`,
  label: `Phòng trọ phường ${name}`,
  to: `/tim-phong?${new URLSearchParams({ ward: `Phường ${name}` })}`,
}));

const legacyPaths: Record<string, string> = {
  '/search': '/tim-phong', '/about': '/ve-chung-toi', '/landlord': '/chu-nha',
  '/partner': '/cong-tac-vien', '/ctv': '/cong-tac-vien', '/blog': '/tin-tuc',
  '/login': '/dang-nhap', '/register': '/dang-ky', '/account': '/tai-khoan',
  '/account/favorites': '/tai-khoan/yeu-thich', '/account/bookings': '/tai-khoan/lich-xem-phong',
  '/account/rentals': '/tai-khoan/phong-da-thue',
  '/forgot-password': '/quen-mat-khau', '/reset-password': '/dat-lai-mat-khau',
};

export function legacyPublicTarget(pathname: string, search = '', hash = '') {
  const path = pathname.replace(/\/+$/, '') || '/';
  let target = legacyPaths[path];
  const detail = /^\/(building|room|blog)\/([^/]+)$/.exec(path);
  if (detail) target = `/${({ building: 'toa-nha', room: 'phong', blog: 'tin-tuc' } as Record<string, string>)[detail[1]]}/${detail[2]}`;
  return target ? `${target}${search}${hash}` : null;
}
