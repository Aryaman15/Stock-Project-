const ymd = (d: Date) => d.toISOString().slice(0, 10);
export class TradingCalendar {
  private readonly holidaySet: Set<string>;
  constructor(holidays: string[] = []) { this.holidaySet = new Set(holidays); }
  isTradingDay(date: Date): boolean { const day = date.getUTCDay(); return day !== 0 && day !== 6 && !this.holidaySet.has(ymd(date)); }
  addTradingDays(date: Date, n: number): Date { const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); let count = 0; while (count < n) { result.setUTCDate(result.getUTCDate() + 1); if (this.isTradingDay(result)) count++; } return result; }
  tradingDaysBetween(start: Date, end: Date): number { let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); let n = 0; while (cursor < end) { cursor.setUTCDate(cursor.getUTCDate() + 1); if (this.isTradingDay(cursor)) n++; } return n; }
}
