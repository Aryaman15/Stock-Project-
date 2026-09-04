import { describe, expect, it } from 'vitest';
import { TradingCalendar } from '../src/shared/trading-calendar.js';
import { clockFrom } from '../src/shared/clock.js';
import { admissibleFilter } from '../src/services/domain.js';

describe('TradingCalendar', () => {
  const calendar = new TradingCalendar(['2025-01-01']);
  it('excludes weekends', () => expect(calendar.isTradingDay(new Date('2025-01-04T00:00:00Z'))).toBe(false));
  it('excludes configured holidays', () => expect(calendar.isTradingDay(new Date('2025-01-01T00:00:00Z'))).toBe(false));
  it('adds trading-day deadlines across weekends and holidays', () => expect(calendar.addTradingDays(new Date('2024-12-31T00:00:00Z'), 2).toISOString().slice(0,10)).toBe('2025-01-03'));
  it('counts only trading days', () => expect(calendar.tradingDaysBetween(new Date('2024-12-31T00:00:00Z'), new Date('2025-01-06T00:00:00Z'))).toBe(3));
});
describe('clock admission', () => {
  const asOf = new Date('2025-02-10T00:00:00Z');
  it('accepts an explicit replay clock', () => expect(clockFrom({ mode:'REPLAY', asOf }).mode).toBe('REPLAY'));
  it('rejects a future replay clock', () => expect(() => clockFrom({mode:'REPLAY',asOf:new Date('2999-01-01')})).toThrow('Clock context'));
  it('excludes observations after replay as-of', () => { const q:any=admissibleFilter('i', {mode:'REPLAY',asOf}); expect(q.observedAt.$lte).toEqual(asOf); expect(q.availableAt.$lte).toEqual(asOf); });
  it('excludes observations unavailable at replay time', () => { const q:any=admissibleFilter('i',{mode:'REPLAY',asOf}); expect(q.availableAt.$lte.getTime()).toBe(asOf.getTime()); });
  it('bounds bar reads by creation and replay time', () => { const start=new Date('2025-02-01T00:00:00Z'); const q:any=admissibleFilter('i',{mode:'REPLAY',asOf},start); expect(q.observedAt).toEqual({$gte:start,$lte:asOf}); });
});
