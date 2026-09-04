import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/smart-market-watchlist'),
  JWT_SECRET: z.string().min(16).optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  NSE_HOLIDAYS: z.string().default(''),
  TWELVE_DATA_API_KEY: z.string().optional(),
  TWELVE_DATA_BASE_URL: z.string().url().default('https://api.twelvedata.com')
});
const parsed = schema.parse(process.env);
if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET) throw new Error('JWT_SECRET is required in production');
export const env = { ...parsed, JWT_SECRET: parsed.JWT_SECRET ?? 'development-secret-change-me' };
export const holidays = env.NSE_HOLIDAYS.split(',').map(x => x.trim()).filter(Boolean);
