import type { Amenity, AmenityCategory, AmenityScope } from '@tinyhouse/contracts';

export const AMENITY_CATEGORY_LABELS: Record<AmenityCategory, string> = {
  building_common: 'Tiện ích chung',
  building_security: 'An ninh',
  building_fire_safety: 'PCCC & thoát nạn',
  building_other: 'Khác',
  room_furniture: 'Nội thất',
  room_electrical: 'Thiết bị điện',
  room_other: 'Tiện ích khác',
  room_fire_safety: 'PCCC & an toàn',
};

export function categoryOptions(scope: AmenityScope) {
  return (scope === 'building'
    ? ['building_common', 'building_security', 'building_fire_safety', 'building_other']
    : ['room_furniture', 'room_electrical', 'room_other', 'room_fire_safety']) as AmenityCategory[];
}

export function scopeLabel(scope: AmenityScope) {
  return scope === 'building' ? 'Tòa nhà' : 'Loại phòng';
}

export function amenitySourceLabel(source: string) {
  if (source === 'excel_f031') return 'Danh mục tiện ích';
  if (source === 'legacy_mapping') return 'Dữ liệu cũ';
  return 'Quản trị viên';
}

export function amenityErrorMessage(error: unknown) {
  const value = error as { message?: string; error?: string; data?: { error?: string } };
  return value?.data?.error || value?.error || value?.message || 'Không thể xử lý tiện ích.';
}

export function amenitySearchText(amenity: Amenity) {
  return `${amenity.name} ${amenity.code} ${AMENITY_CATEGORY_LABELS[amenity.category]} ${amenitySourceLabel(amenity.source)}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
