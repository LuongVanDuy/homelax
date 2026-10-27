import { z } from 'zod';

const mapPointSchema = z.tuple([z.number().finite().min(-90).max(90), z.number().finite().min(-180).max(180)]);
export const publicMapPolygonSchema = z.array(mapPointSchema).min(3).max(32).superRefine((points, ctx) => {
  const invalid = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (new Set(points.map(p => p.join(','))).size !== points.length) invalid('Các điểm vẽ phải khác nhau.');
  const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const area = points.reduce((sum, p, i) => sum + cross(points[0], p, points[(i + 1) % points.length]), 0);
  if (Math.abs(area) < 1e-10) invalid('Vùng vẽ phải có diện tích.');
  const onSegment = (a: number[], b: number[], p: number[]) => Math.abs(cross(a, b, p)) < 1e-12
    && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if ((cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)
      || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) {
      invalid('Các cạnh vùng vẽ không được cắt nhau.'); return;
    }
  }
});

export function decodeMapPolygon(value: string | undefined) {
  if (!value) return undefined;
  try {
    const result = publicMapPolygonSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : undefined;
  } catch { return undefined; }
}

export const publicMapBoundsSchema = z.object({
  type: z.literal('bounds'),
  south: z.number().finite().min(-90).max(90),
  west: z.number().finite().min(-180).max(180),
  north: z.number().finite().min(-90).max(90),
  east: z.number().finite().min(-180).max(180),
  polygon: publicMapPolygonSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.south >= value.north) context.addIssue({ code: 'custom', path: ['north'], message: 'Biên bắc phải lớn hơn biên nam.' });
  if (value.west >= value.east) context.addIssue({ code: 'custom', path: ['east'], message: 'Biên đông phải lớn hơn biên tây.' });
  if (value.north - value.south > 0.5) context.addIssue({ code: 'custom', path: ['north'], message: 'Vùng tìm kiếm quá cao.' });
  if (value.east - value.west > 0.5) context.addIssue({ code: 'custom', path: ['east'], message: 'Vùng tìm kiếm quá rộng.' });
  if (value.polygon?.some(([lat, lng]) => lat < value.south || lat > value.north || lng < value.west || lng > value.east)) {
    context.addIssue({ code: 'custom', path: ['polygon'], message: 'Điểm vẽ nằm ngoài biên vùng tìm kiếm.' });
  }
});

export type PublicMapBounds = z.infer<typeof publicMapBoundsSchema>;
