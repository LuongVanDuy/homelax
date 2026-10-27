import { regionalSearchLinks } from '../../app/router/publicDestinations';
import { TINY_HOUSES_PUBLIC_CONTACT } from '@tinyhouse/contracts';
import { routePaths } from '../../app/router/routePaths';

/** Public brand/contact copy from F023/E24. Phone and Zalo share the inventory contact. */
export const publicSite = {
  ...TINY_HOUSES_PUBLIC_CONTACT,
  logo: '/homelax-logo.png',
  description: 'Đơn vị quản lý vận hành phòng trọ/ccmn tại Hà Nội',
  email: 'mkt@homelax.vn',
  address: 'Số 151 phố Vương Thừa Vũ, Phường Phương Liệt, Thành phố Hà Nội',
  company: 'Công ty Cổ phần Đầu tư Phát triển Tiny Houses',
  taxCode: '0110674192',
  issuedOn: '04/04/2024',
  representative: 'Lê Thuận Khánh',
  copyright: '© 2026 Homelax. Bảo lưu mọi quyền.',
} as const;

// Footer destinations share the public route and filter registry.
export const footerLinkGroups = [
  {
    id: 'rent', title: 'Cho thuê', links: [
      ...regionalSearchLinks,
      { label: 'Gần trường đại học', to: '/tim-phong?nearSchool=any' },
      { label: 'Tất cả phòng trống', to: '/tim-phong?availability=available' },
    ],
  },
  {
    id: 'company', title: 'Homelax', links: [
      { label: 'Về chúng tôi', to: '/ve-chung-toi' },
      { label: 'Chủ nhà hợp tác', to: '/chu-nha' },
      { label: 'CTV hợp tác', to: '/cong-tac-vien' },
      { label: 'Tin tức', to: '/tin-tuc' },
      { label: 'Liên hệ', to: routePaths.contact },
    ],
  },
  {
    id: 'policies', title: 'Quy định', links: [
      { label: 'Điều khoản sử dụng', to: '/dieu-khoan' },
      { label: 'Chính sách bảo mật', to: '/chinh-sach-bao-mat' },
      { label: 'Quy chế hoạt động TMĐT', to: '/quy-che-tmdt' },
      { label: 'Cơ chế giải quyết tranh chấp', to: '/giai-quyet-tranh-chap' },
      { label: 'Tiếp nhận phản ánh của tổ chức xã hội', to: '/phan-anh' },
    ],
  },
] as const;

export const publicSocialLinks = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/TinyHouses.vn/' },
  { id: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@timphong.tinyhouses' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/tinyhouses.vn/' },
  { id: 'threads', label: 'Threads', href: 'https://www.threads.com/@tinyhouses.vn' },
  { id: 'zalo', label: 'Zalo', href: publicSite.zaloUrl },
] as const;
