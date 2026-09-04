import { ContractEvent, Expectation, NormalityContract } from '../models.js';
import type { ClockContext } from '../shared/clock.js';
import { AppError } from '../shared/errors.js';
import { admissibleBars } from './domain.js';

const value = (x: any) => Number(x.adjustedClose ?? x.close ?? x.price);
const marketReturn = (a: number, b: number) => (b - a) / a;
const isBeforeOrAt = (value: unknown, boundary: Date) => Boolean(value) && new Date(value as any) <= boundary;

export async function resolveNormalityContract(userId: string, id: string, clock: ClockContext) {
  const contract: any = await NormalityContract.findOne({ _id: id, userId });
  if (!contract) throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Normality contract not found');
  if (!['ACTIVE', 'PENDING_DATA'].includes(contract.status)) return contract;
  const scheduled = contract.clauses.filter((clause: any) => clause.type === 'SCHEDULED_EVENT');
  const occurred = scheduled
    .filter((clause: any) => isBeforeOrAt(clause.availableAt, clock.asOf) && isBeforeOrAt(clause.observedAt, contract.deadlineTradingDate))
    .map((clause: any) => ({ signal: 'EVENT_OCCURRED', expected: { eventType: clause.eventType, expectedDate: clause.expectedDate }, actual: { observedAt: clause.observedAt }, delta: null, evidenceRefs: clause.evidenceRefs ?? [], domainTimestamp: clause.observedAt }));
  if (occurred.length) return finish(contract, clock, 'EVENT_OCCURRED', occurred, userId);
  if (scheduled.length && clock.asOf >= contract.deadlineTradingDate) return finish(contract, clock, 'EXPIRED_UNANSWERED', scheduled.map((clause: any) => ({ signal: 'EXPECTED_EVENT_MISSING', expected: { eventType: clause.eventType, expectedDate: clause.expectedDate }, actual: null, delta: null, evidenceRefs: [], domainTimestamp: contract.deadlineTradingDate })), userId);
  const userClauses = contract.clauses.filter((clause: any) => clause.type === 'USER_EXPECTATION_CLAUSE' && clause.expectationId);
  const userSignals: any[] = [];
  let unresolvedUserClause = false;
  for (const clause of userClauses) {
    const expectation: any = await Expectation.findOne({ _id: clause.expectationId, userId }).lean();
    if (!expectation) { unresolvedUserClause = true; continue; }
    if (expectation.status === 'UNSCOREABLE' && expectation.resolution && isBeforeOrAt(expectation.resolution.resolvedAtDomainTime, clock.asOf)) {
      userSignals.push({ signal: 'UNRESOLVABLE', reasonCode: 'LINKED_EXPECTATION_UNSCOREABLE', expected: expectation.humanReadableQuestion, actual: expectation.resolution.reason, delta: null, evidenceRefs: [String(expectation._id)], domainTimestamp: expectation.resolution.resolvedAtDomainTime });
    } else if (expectation.resolution && isBeforeOrAt(expectation.resolution.resolvedAtDomainTime, clock.asOf)) {
      userSignals.push({ signal: expectation.resolution.outcome === 'CONFIRMED' ? 'EVENT_OCCURRED' : expectation.resolution.outcome === 'DISCONFIRMED' ? 'EXPECTED_EVENT_MISSING' : 'SILENT_STORY', expected: expectation.humanReadableQuestion, actual: expectation.resolution.measurement, delta: expectation.resolution.measurement?.relativePerformancePct ?? expectation.resolution.measurement?.participationRatio ?? null, evidenceRefs: [String(expectation._id)], domainTimestamp: expectation.resolution.resolvedAtDomainTime });
    } else unresolvedUserClause = true;
  }
  if (userSignals.some(signal => signal.signal === 'UNRESOLVABLE')) return finish(contract, clock, 'UNRESOLVABLE', userSignals, userId);
  if (userSignals.some(signal => signal.signal === 'EVENT_OCCURRED')) return finish(contract, clock, 'EVENT_OCCURRED', userSignals, userId);
  if (userSignals.length) return finish(contract, clock, 'DEPARTED', userSignals, userId);
  if (unresolvedUserClause && clock.asOf >= contract.deadlineTradingDate) return finish(contract, clock, 'EXPIRED_UNANSWERED', userClauses.map((clause: any) => ({ signal: 'EXPECTED_EVENT_MISSING', expected: { expectationId: clause.expectationId }, actual: null, delta: null, evidenceRefs: [String(clause.expectationId)], domainTimestamp: contract.deadlineTradingDate })), userId);
  const end = clock.asOf < contract.deadlineTradingDate ? clock.asOf : contract.deadlineTradingDate;
  const bars = await admissibleBars(contract.instrumentId, contract.startTradingDate, { ...clock, asOf: end });
  const safe = bars.filter((bar: any) => bar.adjustmentStatus === 'SAFE' && bar.freshness !== 'STALE');
  if (safe.length < 2) {
    if (clock.asOf < contract.deadlineTradingDate) return pending(contract, clock, 'INSUFFICIENT_ADJUSTMENT_SAFE_HISTORY', userId);
    return finish(contract, clock, 'UNRESOLVABLE', [{ signal: 'UNRESOLVABLE', reasonCode: 'INSUFFICIENT_ADJUSTMENT_SAFE_HISTORY' }], userId);
  }
  const signals: any[] = [];
  const range = contract.clauses.find((clause: any) => clause.type === 'NORMAL_DAILY_RANGE');
  if (range) for (let i = 1; i < safe.length; i++) {
    const daily = marketReturn(value(safe[i - 1]), value(safe[i]));
    if (Math.abs(daily) > range.p95AbsoluteReturn) signals.push({ signal: 'RANGE_BREAK', expected: { maximumAbsoluteDailyReturn: range.p95AbsoluteReturn }, actual: { dailyReturn: daily }, delta: Math.abs(daily) - range.p95AbsoluteReturn, evidenceRefs: [String(safe[i]._id)], domainTimestamp: safe[i].observedAt });
  }
  const participation = contract.clauses.find((clause: any) => clause.type === 'BENCHMARK_PARTICIPATION');
  if (participation && contract.benchmarkInstrumentId) {
    const benchmarkBars = await admissibleBars(contract.benchmarkInstrumentId, contract.startTradingDate, { ...clock, asOf: end });
    const safeBenchmark = benchmarkBars.filter((bar: any) => bar.adjustmentStatus === 'SAFE' && bar.freshness !== 'STALE');
    const stockByDay = new Map(safe.map((bar: any) => [new Date(bar.observedAt).toISOString().slice(0, 10), bar]));
    const aligned = safeBenchmark
      .map((benchmark: any) => ({ benchmark, stock: stockByDay.get(new Date(benchmark.observedAt).toISOString().slice(0, 10)) }))
      .filter((pair: any) => pair.stock);
    if (aligned.length < 2) {
      if (clock.asOf < contract.deadlineTradingDate) return pending(contract, clock, 'BENCHMARK_EVIDENCE_PENDING', userId);
      return finish(contract, clock, 'UNRESOLVABLE', [{ signal: 'UNRESOLVABLE', reasonCode: 'BENCHMARK_EVIDENCE_MISSING', expected: 'At least two aligned adjustment-safe observations', actual: { alignedObservations: aligned.length }, delta: null, evidenceRefs: [] }], userId);
    }
    const first = aligned[0] as any; const last = aligned.at(-1) as any;
    const benchmarkMove = marketReturn(value(first.benchmark), value(last.benchmark));
    const stockMove = marketReturn(value(first.stock), value(last.stock));
    const expectedMove = benchmarkMove * participation.participationBeta; const delta = stockMove - expectedMove;
    if (Math.abs(delta) > Number(range?.p95AbsoluteReturn ?? .05)) signals.push({ signal: 'PARTICIPATION_BREAK', silentStory: true, expected: { participationBeta: participation.participationBeta, stockMove: expectedMove }, actual: { benchmarkMove, stockMove, participationRatio: benchmarkMove === 0 ? null : stockMove / benchmarkMove }, delta, evidenceRefs: [String(last.stock._id), String(last.benchmark._id)], domainTimestamp: last.stock.observedAt });
  }
  if (signals.some(x => x.signal === 'EVENT_OCCURRED')) return finish(contract, clock, 'EVENT_OCCURRED', signals, userId);
  if (signals.length) return finish(contract, clock, 'DEPARTED', signals, userId);
  if (clock.asOf >= contract.deadlineTradingDate) return finish(contract, clock, 'CLOSED_NORMAL', [{ signal: 'EXPIRED_NORMAL', expected: 'No sealed clause breach', actual: 'No material departure detected', delta: 0, evidenceRefs: safe.map((bar: any) => String(bar._id)) }], userId);
  const dataRecovered = contract.status === 'PENDING_DATA';
  contract.status = 'ACTIVE';
  contract.resolution = result('ACTIVE', [], contract, clock, 'GOOD');
  await contract.save();
  if (dataRecovered) await ContractEvent.create({ userId, contractId: contract._id, instrumentId: contract.instrumentId, watchlistId: contract.watchlistId, type: 'DATA_QUALITY_CHANGED', domainTimestamp: clock.asOf, recordedAt: new Date(), availableAt: clock.asOf, evidence: { dataQuality: 'GOOD' } });
  return contract;
}

async function finish(contract: any, clock: ClockContext, state: string, signals: any[], userId: string) {
  contract.status = state; contract.resolution = result(state, signals, contract, clock, state === 'UNRESOLVABLE' ? 'LIMITED' : 'GOOD');
  await contract.save();
  const type = state === 'DEPARTED' ? 'CONTRACT_DEPARTED' : state === 'CLOSED_NORMAL' ? 'CONTRACT_CLOSED_NORMAL' : state === 'EVENT_OCCURRED' ? 'EVENT_OCCURRED' : state === 'EXPIRED_UNANSWERED' ? 'CONTRACT_EXPIRED_UNANSWERED' : 'CONTRACT_UNRESOLVABLE';
  await ContractEvent.create({ userId, contractId: contract._id, instrumentId: contract.instrumentId, watchlistId: contract.watchlistId, type, domainTimestamp: clock.asOf, recordedAt: new Date(), availableAt: clock.asOf, evidence: contract.resolution });
  return contract;
}

async function pending(contract: any, clock: ClockContext, reasonCode: string, userId: string) {
  const previousReason = contract.resolution?.signals?.find((signal: any) => signal.signal === 'DATA_QUALITY_CHANGED')?.reasonCode;
  const changed = contract.status !== 'PENDING_DATA' || previousReason !== reasonCode;
  contract.status = 'PENDING_DATA';
  contract.resolution = result('ACTIVE', [{ signal: 'DATA_QUALITY_CHANGED', reasonCode, expected: 'Sufficient adjustment-safe evidence', actual: 'Evidence is not yet sufficient', delta: null, evidenceRefs: [] }], contract, clock, 'LIMITED');
  await contract.save();
  if (changed) await ContractEvent.create({ userId, contractId: contract._id, instrumentId: contract.instrumentId, watchlistId: contract.watchlistId, type: 'DATA_QUALITY_CHANGED', domainTimestamp: clock.asOf, recordedAt: new Date(), availableAt: clock.asOf, evidence: contract.resolution });
  return contract;
}

function result(state: string, signals: any[], contract: any, clock: ClockContext, dataQuality: string) {
  return {
    state,
    signals,
    expected: signals.map(signal => signal.expected ?? null),
    actual: signals.map(signal => signal.actual ?? null),
    delta: signals.map(signal => signal.delta ?? null),
    evidenceRefs: [...new Set(signals.flatMap(signal => signal.evidenceRefs ?? []))],
    resolverVersion: contract.resolverVersion,
    domainTimestamp: clock.asOf,
    recordedAt: new Date(),
    dataQuality
  };
}
