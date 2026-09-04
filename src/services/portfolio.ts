import { MarketObservation, PaperHolding } from '../models.js';
import { env } from '../config/env.js';
import { brokerForMode } from './orders.js';

const selectedMode=(mode?:string)=>(mode??env.TRADING_MODE) as 'PAPER'|'LIVE';
export async function getHoldings(userId:string,mode?:string){
  const selected=selectedMode(mode);const provider=selected==='LIVE'?'GROWW':'PAPER';
  if(selected==='PAPER'){const rows:any[]=await PaperHolding.find({userId,quantity:{$gt:0}}).lean();return{mode:selected,provider,holdings:rows.map(row=>({instrumentId:row.instrumentId,symbol:row.symbol,quantity:row.quantity,averagePrice:row.averagePrice,realizedPnl:row.realizedPnl}))};}
  const rows:any[]=await brokerForMode('LIVE').getHoldings(userId);return{mode:selected,provider,holdings:rows.map(row=>({instrumentId:row.instrument_id,tradingSymbol:row.trading_symbol??row.symbol,quantity:Number(row.quantity??row.available_quantity??0),averagePrice:Number(row.average_price??row.average_buy_price??0),currentPrice:Number(row.ltp??row.current_price??0),rawStatus:row.status}))};
}

export async function getPositions(userId:string,mode?:string){
  const selected=selectedMode(mode);const provider=selected==='LIVE'?'GROWW':'PAPER';
  if(selected==='PAPER'){const rows:any[]=await PaperHolding.find({userId,quantity:{$gt:0}}).lean();const positions=await Promise.all(rows.map(async row=>{const quote:any=await MarketObservation.findOne({instrumentId:row.instrumentId,availableAt:{$lte:new Date()},observedAt:{$lte:new Date()}}).sort({observedAt:-1}).lean();const currentPrice=Number(quote?.price??row.averagePrice);return{instrumentId:row.instrumentId,symbol:row.symbol,quantity:row.quantity,averagePrice:row.averagePrice,currentPrice,marketValue:row.quantity*currentPrice,unrealizedPnl:(currentPrice-row.averagePrice)*row.quantity,realizedPnl:row.realizedPnl};}));return{mode:selected,provider,positions};}
  const rows:any[]=await brokerForMode('LIVE').getPositions(userId);return{mode:selected,provider,positions:rows.map(row=>({instrumentId:row.instrument_id,tradingSymbol:row.trading_symbol??row.symbol,quantity:Number(row.quantity??row.net_quantity??0),averagePrice:Number(row.average_price??0),currentPrice:Number(row.ltp??row.current_price??0),unrealizedPnl:Number(row.unrealised_pnl??row.unrealized_pnl??0),realizedPnl:Number(row.realised_pnl??row.realized_pnl??0),rawStatus:row.status}))};
}
