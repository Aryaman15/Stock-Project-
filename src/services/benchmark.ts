import { Instrument } from '../models.js';
const sectorSymbols:Record<string,string>={IT:'NIFTYIT','INFORMATION TECHNOLOGY':'NIFTYIT',AUTO:'NIFTYAUTO',AUTOMOBILE:'NIFTYAUTO',BANKING:'NIFTYBANK',BANK:'NIFTYBANK',ENERGY:'NIFTYENERGY'};
export async function resolveBenchmarkInstrument(instrument:any,explicitId?:string){if(explicitId)return Instrument.findOne({_id:explicitId,active:true}).lean();const symbol=sectorSymbols[String(instrument.sector??'').toUpperCase()];return symbol?Instrument.findOne({symbol,exchange:'NSE',active:true}).lean():null;}
