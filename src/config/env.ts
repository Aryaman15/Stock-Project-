import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/smart-market-watchlist'),
  JWT_SECRET: z.string().min(16).default('development-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  NSE_HOLIDAYS: z.string().default(''),
  TWELVE_DATA_API_KEY: z.string().optional(),
  TWELVE_DATA_BASE_URL: z.string().url().default('https://api.twelvedata.com')
});
export const env = schema.parse(process.env);
export const holidays = env.NSE_HOLIDAYS.split(',').map(x => x.trim()).filter(Boolean);
