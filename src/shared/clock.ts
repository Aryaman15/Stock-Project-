import { z } from 'zod'; import { AppError } from './errors.js';
export type ClockContext = { mode: 'LIVE' | 'REPLAY'; asOf: Date };
export const clockSchema = z.object({ mode: z.enum(['LIVE', 'REPLAY']), asOf: z.coerce.date() });
export const liveClock = (): ClockContext => ({ mode: 'LIVE', asOf: new Date() });
export const clockFrom = (value?: unknown): ClockContext => { if (!value) return liveClock(); const r = clockSchema.safeParse(value); if (!r.success || r.data.asOf > new Date()) throw new AppError(400, 'INVALID_CLOCK', 'Clock context must contain a valid non-future asOf'); return r.data; };
