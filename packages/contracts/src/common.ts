import { z } from 'zod';

export const idSchema = z
  .string()
  .trim()
  .min(1, 'ID không được để trống.');

export const nonEmptyStringSchema = z
  .string()
  .trim()
  .min(1);

export const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .optional();

export const apiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
  details: z.array(apiErrorDetailSchema).optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
