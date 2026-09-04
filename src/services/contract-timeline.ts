import { ContractEvent, NormalityContract } from '../models.js';
import type { ClockContext } from '../shared/clock.js';
import { AppError } from '../shared/errors.js';
import { admissibleBars } from './domain.js';

const eventType = (type: string) => ({ CONTRACT_UNRESOLVABLE: 'UNRESOLVABLE', CONTRACT_CLOSED_NORMAL: 'CONTRACT_CLOSED', CONTRACT_EXPIRED_UNANSWERED: 'CONTRACT_CLOSED' } as Record<string, string>)[type] ?? type;
const signalType = (type: string) => ({ EXPECTED_EVENT_MISSING: 'EXPECTED_REACTION_MISSING', EXPIRED_NORMAL: 'CONTRACT_CLOSED' } as Record<string, string>)[type] ?? type;

export async function contractTimeline(userId: string, id: string, clock: ClockContext) {
  const contract: any = await NormalityContract.findOne({ _id: id, userId }).lean();
  if (!contract) throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Normality contract not found');
  const [events, bars] = await Promise.all([
    ContractEvent.find({ userId, contractId: contract._id, availableAt: { $lte: clock.asOf } }).sort({ domainTimestamp: 1, recordedAt: 1 }).lean(),
    admissibleBars(contract.instrumentId, contract.startTradingDate, clock)
  ]);
  const storedEvents = events.map((event: any) => ({ type: eventType(event.type), domainTimestamp: event.domainTimestamp, availableAt: event.availableAt, evidence: event.evidence, eventId: event._id }));
  const daily = bars.map((bar: any) => ({ type: 'DAILY_OBSERVATION', domainTimestamp: bar.observedAt, availableAt: bar.availableAt, evidence: { close: bar.adjustedClose ?? bar.close ?? bar.price, volume: bar.volume, observationId: bar._id, adjustmentStatus: bar.adjustmentStatus, freshness: bar.freshness } }));
  const derived: any[] = [];
  for (const event of events as any[]) for (const signal of event.evidence?.signals ?? []) {
    const domainTimestamp = signal.domainTimestamp ?? event.domainTimestamp;
    derived.push({ type: signalType(signal.signal), domainTimestamp, availableAt: event.availableAt, evidence: signal });
    if (signal.silentStory && signal.signal !== 'SILENT_STORY') derived.push({ type: 'SILENT_STORY', domainTimestamp, availableAt: event.availableAt, evidence: signal });
    if (signal.actual?.triggerObservedAt) derived.push({ type: 'BENCHMARK_TRIGGERED', domainTimestamp: signal.actual.triggerObservedAt, availableAt: event.availableAt, evidence: signal.actual });
  }
  const deadline = clock.asOf >= contract.deadlineTradingDate ? [{ type: 'DEADLINE_REACHED', domainTimestamp: contract.deadlineTradingDate, availableAt: contract.deadlineTradingDate, evidence: { status: contract.status } }] : [];
  const timeline = [...storedEvents, ...daily, ...derived, ...deadline]
    .filter((entry: any) => new Date(entry.domainTimestamp) <= clock.asOf && new Date(entry.availableAt) <= clock.asOf)
    .sort((a: any, b: any) => new Date(a.domainTimestamp).getTime() - new Date(b.domainTimestamp).getTime());
  return { clock, contractId: contract._id, timeline };
}
