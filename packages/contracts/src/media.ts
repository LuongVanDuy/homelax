import { z } from 'zod';

export const MEDIA360_KINDS = ['panorama_image', 'tour_url'] as const;

export const media360KindSchema = z.enum(MEDIA360_KINDS);

function validMediaUrl(kind: (typeof MEDIA360_KINDS)[number], url: string) {
  if (kind === 'panorama_image' && url.startsWith('/uploads/')) return true;
  return /^https?:\/\/[^\s]+$/i.test(url);
}

export const media360ItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: media360KindSchema,
  url: z.string().trim().min(1).max(2048),
  title: z.string().trim().max(180),
  sortOrder: z.number().int().min(0).max(9999),
}).strict().superRefine((value, context) => {
  if (!validMediaUrl(value.kind, value.url)) {
    context.addIssue({
      code: 'custom',
      path: ['url'],
      message: value.kind === 'panorama_image'
        ? 'Ảnh 360 phải là URL http(s) hoặc ảnh đã upload.'
        : 'Tour 360 phải dùng URL http(s).',
    });
  }
});

export const media360ListSchema = z.array(media360ItemSchema).max(20);

export type Media360Kind = z.infer<typeof media360KindSchema>;
export type Media360Item = z.infer<typeof media360ItemSchema>;
