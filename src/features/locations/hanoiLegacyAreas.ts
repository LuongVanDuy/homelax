import { z } from 'zod';
import { HANOI_WARDS_URL, parseHanoiWards } from './hanoiWards';

const API = 'https://provinces.open-api.vn/api';
export const HANOI_LEGACY_DISTRICTS_URL = `${API}/v1/p/1?depth=2`;
const codeSchema = z.number().int().positive();
const namedCodeSchema = z.object({ code: codeSchema, name: z.string().trim().min(1) });
const districtSchema = namedCodeSchema.extend({ province_code: z.literal(1) });
export type LegacyArea = z.infer<typeof namedCodeSchema>;
export type CurrentWard = ReturnType<typeof parseHanoiWards>[number];

function uniqueAreas<T extends LegacyArea>(areas: T[]) {
  if (new Set(areas.map(area => area.code)).size !== areas.length) throw new Error('Danh mục địa bàn cũ bị trùng mã.');
  return areas.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function parseHanoiLegacyDistricts(data: unknown): LegacyArea[] {
  const province = z.object({ code: z.literal(1), districts: z.array(districtSchema).min(1) }).parse(data);
  return uniqueAreas(province.districts);
}

export function parseHanoiLegacyWards(data: unknown, districtCode: number): LegacyArea[] {
  codeSchema.parse(districtCode);
  const district = districtSchema.extend({
    code: z.literal(districtCode),
    wards: z.array(namedCodeSchema.extend({ district_code: z.literal(districtCode) })),
  }).parse(data);
  return uniqueAreas(district.wards);
}

export function parseHanoiWardMapping(data: unknown, legacyCode: number, currentWards: CurrentWard[]): CurrentWard[] {
  codeSchema.parse(legacyCode);
  const rows = z.array(z.object({
    source_code: z.literal(legacyCode),
    ward: namedCodeSchema.extend({ province_code: z.literal(1) }),
  })).parse(data);
  // Only match stable codes against the same provider's current Hanoi catalog.
  // Do not infer an identity from similar names or the reuse of an old code.
  const mapped = rows.map(row => {
    const current = currentWards.find(ward => ward.code === String(row.ward.code).padStart(5, '0'));
    if (!current || current.name !== row.ward.name) throw new Error('Ánh xạ chưa khớp danh mục phường/xã hiện hành.');
    return current;
  });
  return [...new Map(mapped.map(ward => [ward.code, ward])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

async function readLocationApi(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    credentials: 'omit',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Chưa tải được dữ liệu địa bàn cũ.');
  return response.json() as Promise<unknown>;
}

export async function fetchHanoiLegacyDistricts(signal?: AbortSignal) {
  return parseHanoiLegacyDistricts(await readLocationApi(HANOI_LEGACY_DISTRICTS_URL, signal));
}

export async function fetchHanoiLegacyWards(districtCode: number, signal?: AbortSignal) {
  codeSchema.parse(districtCode);
  return parseHanoiLegacyWards(await readLocationApi(`${API}/v1/d/${districtCode}?depth=2`, signal), districtCode);
}

export async function fetchHanoiWardMapping(legacyCode: number, signal?: AbortSignal) {
  codeSchema.parse(legacyCode);
  const [mapping, current] = await Promise.all([
    readLocationApi(`${API}/v2/w/from-legacy/?legacy_code=${legacyCode}`, signal),
    readLocationApi(HANOI_WARDS_URL, signal),
  ]);
  return parseHanoiWardMapping(mapping, legacyCode, parseHanoiWards(current));
}
