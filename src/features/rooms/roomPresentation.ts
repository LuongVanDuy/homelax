import type {
  RoomType,
  RoomUnit,
} from '@tinyhouse/contracts';

export function searchable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function roomSearchText(room: RoomType) {
  return searchable([
    room.type,
    room.buildingCode,
    room.buildingName,
    ...room.roomUnits.map((unit) => unit.code),
  ].filter(Boolean).join(' '));
}

export function roomErrorMessage(error: unknown) {
  const value = error as {
    message?: string;
    error?: string;
    data?: { error?: string };
  };
  return value?.data?.error || value?.error || value?.message || 'Không thể xử lý dữ liệu phòng.';
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' đ';
}

export function unitStatusLabel(status: RoomUnit['status']) {
  return {
    available: 'Trống',
    occupied: 'Đang thuê',
    maintenance: 'Bảo trì',
    archived: 'Lưu trữ',
  }[status];
}

export function unitStatusColor(status: RoomUnit['status']) {
  if (status === 'available') return 'success' as const;
  if (status === 'maintenance') return 'warning' as const;
  if (status === 'archived') return 'default' as const;
  return 'info' as const;
}
