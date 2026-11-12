import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8).max(72),
});

export const centerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$/, 'slug_invalid'),
  email: z.union([z.email(), z.literal('')]).optional(),
  phone: z.string().max(30).optional(),
});
