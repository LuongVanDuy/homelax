import type { BuildingRecord } from './building.types';

export function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function buildingSearchText(building: BuildingRecord) {
  return searchable([
    building.code, building.name, building.address, building.ward, building.district, building.city,
    building.hostName, building.hostPhone, building.hostEmail, building.hostAddress,
  ].filter(Boolean).join(' '));
}

export function buildingErrorMessage(error: unknown) {
  const value = error as { message?: string; error?: string; data?: { error?: string } };
  return value?.data?.error || value?.error || value?.message || 'Không thể xử lý tòa nhà.';
}

export function formatPriceRange(building: BuildingRecord) {
  if (!building.minPrice) return 'Chưa có giá';
  const format = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' đ';
  return building.maxPrice > building.minPrice
    ? `${format(building.minPrice)} – ${format(building.maxPrice)}`
    : format(building.minPrice);
}

export function hasBuildingLocation(building: BuildingRecord) {
  return Number.isFinite(building.latitude) && Number.isFinite(building.longitude);
}
