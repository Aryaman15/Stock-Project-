import { AuditEvent, ContractEvent, ExpectationEvent, OrderEvent, SmartOrderEvent } from '../models.js';
import type { ClockContext } from '../shared/clock.js';

export type HistoryQuery={type?:string;entityType?:string;instrumentId?:string;watchlistId?:string;from?:Date;to?:Date;cursor?:Date;limit:number};
export async function getHistory(userId:string,clock:ClockContext,q:HistoryQuery){
  const upper = [clock.asOf, q.to].filter((date): date is Date => Boolean(date)).reduce((earliest, date) => date < earliest ? date : earliest, clock.asOf);
  const cursor = q.cursor && q.cursor <= upper ? q.cursor : undefined;
  const time:any={...(q.from?{$gte:q.from}:{}),...(cursor?{$lt:cursor}:{$lte:upper})};
  const common:any={userId,...(q.type?{type:q.type}:{})};const groups:any[]=[];const requested=q.entityType?.toUpperCase();
  if(!requested||requested==='CONTRACT')groups.push(...(await ContractEvent.find({...common,domainTimestamp:time,availableAt:{$lte:clock.asOf},...(q.instrumentId?{instrumentId:q.instrumentId}:{}),...(q.watchlistId?{watchlistId:q.watchlistId}:{})}).lean()).map((x:any)=>({...x,entityType:'CONTRACT',entityId:x.contractId,timestamp:x.domainTimestamp})));
  if(!requested||requested==='EXPECTATION')groups.push(...(await ExpectationEvent.find({...common,domainTimestamp:time,availableAt:{$lte:clock.asOf},...(q.instrumentId?{instrumentId:q.instrumentId}:{}),...(q.watchlistId?{watchlistId:q.watchlistId}:{})}).lean()).map((x:any)=>({...x,entityType:'EXPECTATION',entityId:x.expectationId,timestamp:x.domainTimestamp})));
  if(!requested||requested==='ORDER')groups.push(...(await OrderEvent.find({...common,recordedAt:time}).lean()).map((x:any)=>({...x,entityType:'ORDER',entityId:x.orderId??x.draftId,timestamp:x.recordedAt})));
  if(!requested||requested==='SMART_ORDER'||requested==='GTT')groups.push(...(await SmartOrderEvent.find({...common,recordedAt:time}).lean()).map((x:any)=>({...x,entityType:'SMART_ORDER',entityId:x.smartOrderId??x.draftId,timestamp:x.recordedAt})));
  const auditFilter:any={...common,timestamp:time,...(requested&&requested!=='AUDIT'?{entityType:requested}:{})};
  const audits=(await AuditEvent.find(auditFilter).lean()).map((x:any)=>({...x,entityType:x.entityType??'AUDIT'}));
  groups.push(...audits);
  const matchesScope=(event:any)=>(!q.instrumentId||String(event.instrumentId??event.metadata?.instrumentId??'')===q.instrumentId)&&(!q.watchlistId||String(event.watchlistId??event.metadata?.watchlistId??'')===q.watchlistId);
  const events=groups.filter(matchesScope).sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,q.limit);
  return{events,nextCursor:events.length===q.limit?events.at(-1)?.timestamp:null,clock};
}
