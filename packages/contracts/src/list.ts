import { z, type ZodTypeAny } from 'zod';

export const listOrderSchema = z.enum(['asc', 'desc']);

export const listQueryBaseSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().max(200).default(''),
  sort: z.string().trim().max(80).default('createdAt'),
  order: listOrderSchema.default('desc'),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export function pagedResponseSchema<T extends ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: paginationSchema,
  });
}

export type ListOrder = z.infer<typeof listOrderSchema>;
export type ListQueryBase = z.infer<typeof listQueryBaseSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type PagedResponse<T> = {
  items: T[];
  pagination: Pagination;
};
