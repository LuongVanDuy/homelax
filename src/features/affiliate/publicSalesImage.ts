import { normalizeAccountPhone, profilePhoneSchema, type PublicRoomSearchQuery } from '@tinyhouse/contracts';
import type { PublicSearch } from '../../app/router/publicSearch';
import { buildingSearchParams } from '../discovery/searchQuery';

export function salesImageSearchParams(filters: PublicSearch): Partial<PublicRoomSearchQuery> {
  const { scope: _scope, status: _status, page: _page, pageSize: _pageSize, sort, ...membership } = buildingSearchParams(filters);
  return {
    ...membership,
    availability: 'available',
    sort: sort === 'vacantRoomsCount' ? 'vacantCount'
      : sort === 'priceAsc' || sort === 'priceDesc' || sort === 'nearest' || sort === 'distance' || sort === 'updated' ? sort : 'smart',
  };
}

export const validSalesImagePhone = (phone: string) => profilePhoneSchema.safeParse(phone).success
  && normalizeAccountPhone(phone).length >= 6;
