import type { AppIdentity } from '../auth/identityStore';
import { canAccessCms } from '../auth/adminAccess';

export const ctvToolPaths = {
  customers: '/cms/my-customers',
  commissions: '/cms/commission-history',
  salesImage: '/cms/sales-image',
} as const;

/** Navigation only. CMS guards and server self-scope remain authoritative. */
export function canUseCtvTools(user: AppIdentity) {
  return user?.roleCode === 'ctv_sale' && canAccessCms(user);
}

export function salesImageHref(buildingId: string, roomId?: string, unitId?: string) {
  const params = new URLSearchParams({ buildingId });
  if (roomId) params.set('roomId', roomId);
  if (roomId && unitId) params.set('unitId', unitId);
  return `${ctvToolPaths.salesImage}?${params}`;
}
