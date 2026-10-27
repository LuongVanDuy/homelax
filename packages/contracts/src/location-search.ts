import { z } from 'zod';

export const originQueryFields = {
  originLat: z.coerce.number().finite().min(-90).max(90).optional(),
  originLng: z.coerce.number().finite().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().finite().min(0.1).max(50).optional(),
};

export function validateSearchOrigin(value: { originLat?: number; originLng?: number; radiusKm?: number; sort?: string; scope?: string }, ctx: z.RefinementCtx) {
  const hasLat = value.originLat !== undefined;
  const hasLng = value.originLng !== undefined;
  if (hasLat !== hasLng || ((!hasLat || !hasLng) && (value.radiusKm !== undefined || value.sort === 'distance'))) {
    ctx.addIssue({ code: 'custom', path: ['originLat'], message: 'Chọn đủ vị trí để lọc hoặc sắp xếp theo khoảng cách.' });
  }
  if (value.scope === 'cms' && (hasLat || hasLng || value.radiusKm !== undefined)) {
    ctx.addIssue({ code: 'custom', path: ['originLat'], message: 'Tìm quanh địa chỉ chỉ dùng cho dữ liệu public.' });
  }
}

export const searchOriginSchema = z.object({
  lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
  label: z.string().trim().min(1).max(320), radiusKm: z.number().min(0.1).max(50).nullable(),
}).strict();
export type SearchOrigin = z.infer<typeof searchOriginSchema>;

export const locationSearchQuerySchema = z.object({ q: z.string().trim().min(3).max(200) }).strict();
export const locationSearchResultSchema = z.object({
  items: z.array(z.object({
    id: z.string().max(100), label: z.string().min(1).max(320),
    lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  }).strict()).max(5),
  attribution: z.literal('© OpenStreetMap contributors'),
}).strict();
export type LocationSearchResult = z.infer<typeof locationSearchResultSchema>;
