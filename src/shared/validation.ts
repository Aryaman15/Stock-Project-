import { z } from 'zod'; import { AppError } from './errors.js';
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => { const r = schema.safeParse(value); if (!r.success) throw new AppError(400, 'VALIDATION_ERROR', r.error.issues.map(i => i.message).join('; ')); return r.data; };
