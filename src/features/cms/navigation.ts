import { Inbox, BadgePercent, Building2, CalendarDays, ContactRound, Database, GraduationCap, History, House, ImagePlus, LayoutDashboard, ReceiptText, ShieldCheck, Sparkles, UserRoundCog, Users } from 'lucide-react';
import { ROLE_SYSTEM_CODES, type CmsRoleScreen } from '@tinyhouse/contracts';
import type { LucideIcon } from 'lucide-react';
import type { AppIdentity } from '../auth/identityStore.js';

export const cmsNavigation = [
  { code: 'dashboard', label: 'Tổng quan', path: '/cms', group: 'Tổng quan', icon: LayoutDashboard, desc: 'Theo dõi hoạt động và số liệu hệ thống', adminOnly: false },
  { code: 'buildings', label: 'Tòa nhà', path: '/cms/buildings', group: 'Quản lý', icon: Building2, desc: 'Quản lý danh mục, địa chỉ và thông tin tòa nhà', adminOnly: false },
  { code: 'buildingAmenities', parentCode: 'buildings', permissionCode: 'buildings', label: 'Tiện ích tòa nhà', path: '/cms/amenities/buildings', group: 'Quản lý', icon: Sparkles, desc: 'Quản lý danh mục tiện ích dùng cho tòa nhà', adminOnly: false },
  { code: 'schools', parentCode: 'buildings', permissionCode: 'buildings', label: 'Trường học', path: '/cms/schools', group: 'Quản lý', icon: GraduationCap, desc: 'Quản lý trường, cơ sở và dữ liệu vị trí', adminOnly: false },
  { code: 'rooms', label: 'Phòng', path: '/cms/rooms', group: 'Quản lý', icon: House, desc: 'Quản lý phòng, giá thuê và tồn phòng', adminOnly: false },
  { code: 'roomTypeCatalog', parentCode: 'rooms', permissionCode: 'rooms', label: 'Loại phòng', path: '/cms/room-types', group: 'Quản lý', icon: House, desc: 'Quản lý danh mục loại phòng dùng chung', adminOnly: false },
  { code: 'roomAmenities', parentCode: 'rooms', permissionCode: 'rooms', label: 'Tiện ích phòng', path: '/cms/amenities/rooms', group: 'Quản lý', icon: Sparkles, desc: 'Quản lý danh mục tiện ích dùng cho phòng', adminOnly: false },
  { code: 'bookings', label: 'Lịch xem phòng', path: '/cms/bookings', group: 'Quản lý', icon: CalendarDays, desc: 'Tiếp nhận và xác nhận lịch hẹn', adminOnly: false },
  { code: 'deals', label: 'Giao dịch thuê', path: '/cms/deals', group: 'Quản lý', icon: ReceiptText, desc: 'Giao dịch thuê theo phạm vi được phân quyền', adminOnly: false },
  { code: 'blog', label: 'Bài viết & Chuyên mục', path: '/cms/blog', group: 'Quản lý', icon: ReceiptText, desc: 'Biên tập và xuất bản tin tức', adminOnly: true },
  { code: 'intake', label: 'Tư vấn / Hợp tác', path: '/cms/intake', group: 'Quản lý', icon: Inbox, desc: 'Tiếp nhận và xử lý yêu cầu tư vấn, hợp tác', adminOnly: true },
  { code: 'customers', label: 'Khách hàng', path: '/cms/customers', group: 'Quản lý', icon: ContactRound, desc: 'Quản lý hồ sơ khách hàng', adminOnly: true },
  { code: 'ctv', parentCode: 'affiliate', label: 'Cộng tác viên', path: '/cms/ctv', group: 'Quản lý', icon: Users, desc: 'Hồ sơ cộng tác viên và liên kết affiliate', adminOnly: true },
  { code: 'commissionConfig', parentCode: 'affiliate', label: 'Cấu hình hoa hồng', path: '/cms/commission-config', group: 'Quản lý', icon: BadgePercent, desc: 'Cơ cấu phân bổ phòng ban/vị trí và tỷ lệ hoa hồng', adminOnly: true },
  { code: 'myCustomers', parentCode: 'affiliate', label: 'Khách của tôi', path: '/cms/my-customers', group: 'Quản lý', icon: ContactRound, desc: 'Theo dõi khách giới thiệu, hành trình và hoa hồng của bạn', adminOnly: false, roleCodes: ['ctv_sale'], roleOnly: true },
  { code: 'salesImage', parentCode: 'affiliate', label: 'Tạo ảnh bán phòng', path: '/cms/sales-image', group: 'Quản lý', icon: ImagePlus, desc: 'Tạo ảnh giới thiệu từ dữ liệu tòa/phòng thật và SĐT CTV', adminOnly: false, roleCodes: ['ctv_sale'], roleOnly: true },
  { code: 'commissionHistory', parentCode: 'affiliate', label: 'Lịch sử hoa hồng', path: '/cms/commission-history', group: 'Quản lý', icon: History, desc: 'Theo dõi và xử lý các khoản hoa hồng', adminOnly: false, roleCodes: ['ctv_sale', 'commission_accountant'] },
  { code: 'affiliate', label: 'Cộng tác viên & hoa hồng', path: '/cms/commission-history', group: 'Quản lý', icon: BadgePercent, desc: 'CTV, khách giới thiệu, công cụ bán phòng và hoa hồng', adminOnly: false, navigationOnly: true },
  { code: 'users', label: 'Người dùng', path: '/cms/users', group: 'Hệ thống', icon: UserRoundCog, desc: 'Tạo, duyệt và quản lý tài khoản hệ thống', adminOnly: true },
  { code: 'permissions', label: 'Vai trò & Phân quyền', path: '/cms/permissions', group: 'Hệ thống', icon: ShieldCheck, desc: 'Quản lý vai trò và quyền truy cập', adminOnly: true },
  { code: 'database', label: 'Sao lưu dữ liệu', path: '/cms/database', group: 'Hệ thống', icon: Database, desc: 'Sao lưu và khôi phục PostgreSQL', adminOnly: true },
  { code: 'auditlog', label: 'Nhật ký hoạt động', path: '/cms/auditlog', group: 'Hệ thống', icon: History, desc: 'Tra cứu lịch sử thao tác trong hệ thống', adminOnly: false },
] as const satisfies ReadonlyArray<{
  code: CmsRoleScreen | 'blog' | 'intake' | 'buildingAmenities' | 'roomTypeCatalog' | 'roomAmenities' | 'schools' | 'customers' | 'ctv' | 'commissionConfig' | 'myCustomers' | 'salesImage' | 'commissionHistory' | 'affiliate' | 'users' | 'permissions' | 'database';
  parentCode?: string;
  permissionCode?: CmsRoleScreen;
  roleCodes?: readonly string[];
  roleOnly?: boolean;
  navigationOnly?: boolean;
  label: string; path: string; group: string; icon: LucideIcon; desc: string; adminOnly: boolean;
}>;

export type CmsSection = typeof cmsNavigation[number]['code'];

export function isCmsAdministrator(user: AppIdentity) {
  return ROLE_SYSTEM_CODES.some((code) => code === user?.roleCode);
}

/** Mirrors screen/role gates for navigation; the backend remains authoritative. */
export function getCmsNavigation(user: AppIdentity) {
  const screens = Array.isArray(user?.allowedScreens) ? user.allowedScreens : [];
  const admin = isCmsAdministrator(user);
  const roleCode = String(user?.roleCode || '');

  const directlyAccessible = cmsNavigation.filter((item) => {
    if ('navigationOnly' in item && item.navigationOnly) return false;
    const requiredScreen = 'permissionCode' in item && item.permissionCode
      ? item.permissionCode
      : item.code;
    const roleGranted = 'roleCodes' in item && (item.roleCodes as readonly string[] | undefined)?.includes(roleCode);
    const fixedConsumerRole = roleCode === 'ctv_sale' || roleCode === 'commission_accountant';
    if (fixedConsumerRole && !roleGranted) return false;
    const roleOnly = 'roleOnly' in item && Boolean(item.roleOnly);
    if (roleOnly && !roleGranted) return false;
    return (!item.adminOnly || admin) &&
      (admin || roleGranted || screens.includes('*') || screens.includes(requiredScreen));
  });

  return cmsNavigation.filter((item) => {
    if ('navigationOnly' in item && item.navigationOnly) {
      return directlyAccessible.some((child) => 'parentCode' in child && child.parentCode === item.code);
    }
    return directlyAccessible.some((allowed) => allowed.code === item.code);
  });
}
