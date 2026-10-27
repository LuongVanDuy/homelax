import { z } from 'zod';
import { listQueryBaseSchema, pagedResponseSchema } from './list.js';

export const blogSlugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường, số và dấu gạch nối.');
export const blogCategoryWriteSchema = z.object({ name: z.string().trim().min(1).max(120), slug: blogSlugSchema }).strict();
export const blogCategorySchema = blogCategoryWriteSchema.extend({ id: z.string(), postCount: z.number().int().nonnegative() });
export const blogCategoriesSchema = z.array(blogCategorySchema);
export const blogPostWriteSchema = z.object({
  title: z.string().trim().min(1).max(200), slug: blogSlugSchema, categoryId: z.string().min(1),
  excerpt: z.string().trim().min(1).max(600),
  coverImage: z.string().trim().min(1).max(2000).refine(value => /^\/(?!\/)[^\s]*$/.test(value) || /^https?:\/\/[^\s]+$/i.test(value), 'Ảnh phải là đường dẫn nội bộ hoặc URL HTTP(S).'),
  content: z.string().trim().min(1).max(100000), status: z.enum(['draft', 'published']),
}).strict();
export const blogPostUpdateSchema = blogPostWriteSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export const blogPostCardSchema = blogPostWriteSchema.omit({ content: true, status: true, categoryId: true }).extend({
  id: z.string(), category: blogCategoryWriteSchema.extend({ id: z.string() }), publishedAt: z.string().nullable(),
}).strip();
export const blogPublicPostSchema = blogPostCardSchema.extend({ content: z.string(), updatedAt: z.string() });
export const blogAdminPostSchema = blogPublicPostSchema.extend({ status: z.enum(['draft','published']), revision: z.number().int(), categoryId: z.string() });
export const blogPublicPageSchema = pagedResponseSchema(blogPostCardSchema);
export const blogAdminPageSchema = pagedResponseSchema(blogAdminPostSchema);
export const blogListQuerySchema = listQueryBaseSchema.pick({ page: true, pageSize: true, search: true }).extend({
  category: z.string().max(160).default(''), status: z.enum(['','draft','published']).default(''),
});
export const blogDeleteSchema = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
export type BlogListQuery = z.infer<typeof blogListQuerySchema>;
export type BlogCategory = z.infer<typeof blogCategorySchema>;
export type BlogCategoryWrite = z.infer<typeof blogCategoryWriteSchema>;
export type BlogPostWrite = z.infer<typeof blogPostWriteSchema>;
export type BlogPostUpdate = z.infer<typeof blogPostUpdateSchema>;
export type BlogPostCard = z.infer<typeof blogPostCardSchema>;
export type BlogAdminPost = z.infer<typeof blogAdminPostSchema>;
