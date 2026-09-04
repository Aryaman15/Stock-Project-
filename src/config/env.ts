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
  TWELVE_DATA_BASE_URL: z.string().url().default('https://api.twelvedata.com'),
  AGENT_ENABLED: z.enum(['true','false']).default('false').transform(v=>v==='true'),
  AGENT_LLM_BASE_URL: z.string().url().optional(), AGENT_LLM_API_KEY: z.string().optional(), AGENT_LLM_MODEL: z.string().optional(),
  AGENT_MAX_TOOL_CALLS: z.coerce.number().int().min(1).max(20).default(8), AGENT_MAX_TURNS: z.coerce.number().int().min(1).max(20).default(8),
  TRADING_MODE: z.enum(['PAPER','LIVE']).default('PAPER'), BROKER_PROVIDER: z.enum(['PAPER','GROWW']).default('PAPER'),
  LIVE_TRADING_ENABLED: z.enum(['true','false']).default('false').transform(v=>v==='true'),
  GROWW_API_BASE_URL: z.string().url().default('https://api.groww.in/v1'), GROWW_ACCESS_TOKEN: z.string().optional(), LIVE_TRADING_USER_ALLOWLIST: z.string().default(''),
  LIVE_MAX_ORDER_NOTIONAL: z.coerce.number().positive().default(10000), LIVE_MAX_ORDER_QUANTITY: z.coerce.number().int().positive().default(10),
  ORDER_CONFIRMATION_TTL_SECONDS: z.coerce.number().int().positive().default(120), ORDER_REQUOTE_THRESHOLD_PCT: z.coerce.number().positive().default(1)
});
const parsed = schema.parse(process.env);
if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET) throw new Error('JWT_SECRET is required in production');
if(parsed.AGENT_ENABLED&&(!parsed.AGENT_LLM_BASE_URL||!parsed.AGENT_LLM_API_KEY||!parsed.AGENT_LLM_MODEL))throw new Error('Agent LLM configuration is required when AGENT_ENABLED=true');
if(parsed.TRADING_MODE==='LIVE'&&parsed.BROKER_PROVIDER==='GROWW'&&parsed.LIVE_TRADING_ENABLED&&!parsed.GROWW_ACCESS_TOKEN)throw new Error('GROWW_ACCESS_TOKEN is required for live Groww trading');
export const env = { ...parsed, JWT_SECRET: parsed.JWT_SECRET ?? 'development-secret-change-me' };
export const holidays = env.NSE_HOLIDAYS.split(',').map(x => x.trim()).filter(Boolean);
