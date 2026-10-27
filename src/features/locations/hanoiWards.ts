import { z } from 'zod';

export const HANOI_WARDS_URL = 'https://provinces.open-api.vn/api/v2/p/1?depth=2';
export const HANOI_CITY = 'Hà Nội';

const hanoiProvinceSchema = z.object({
  code: z.literal(1),
  wards: z.array(z.object({
    code: z.number().int().positive(),
    name: z.string().trim().min(1),
    division_type: z.enum(['phường', 'xã']),
    province_code: z.literal(1),
  })).min(1),
});

export function parseHanoiWards(data: unknown) {
  const { wards } = hanoiProvinceSchema.parse(data);
  if (new Set(wards.map(ward => ward.code)).size !== wards.length
    || new Set(wards.map(ward => ward.name)).size !== wards.length) {
    throw new Error('Danh mục phường/xã bị trùng.');
  }
  return wards.map(ward => ({
    code: String(ward.code).padStart(5, '0'),
    name: ward.name,
    group: ward.division_type === 'phường' ? 'Phường' : 'Xã',
  })).sort((a, b) => a.group.localeCompare(b.group, 'vi') || a.name.localeCompare(b.name, 'vi'));
}

export async function fetchHanoiWards(signal?: AbortSignal) {
  const response = await fetch(HANOI_WARDS_URL, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    credentials: 'omit',
  });
  if (!response.ok) throw new Error('Chưa tải được phường/xã Hà Nội.');
  return parseHanoiWards(await response.json());
}
