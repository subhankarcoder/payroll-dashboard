import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { message: 'Please enter your work email or employee code' }),
  password: z.string().min(1, { message: 'Please enter your password' }),
});

// fallow-ignore-next-line unused-type
export type LoginInput = z.infer<typeof loginSchema>;
