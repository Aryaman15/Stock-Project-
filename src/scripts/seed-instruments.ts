import mongoose from 'mongoose'; import { env } from '../config/env.js'; import { Instrument } from '../models.js';
const samples=[['RELIANCE','Reliance Industries','Energy'],['INFY','Infosys','Information Technology'],['TCS','Tata Consultancy Services','Information Technology'],['NIFTYIT','NIFTY IT','Index'],['NIFTYENERGY','NIFTY ENERGY','Index']];
async function main() { await mongoose.connect(env.MONGODB_URI); for(const [symbol,name,sector] of samples) await Instrument.updateOne({symbol,exchange:'NSE'},{$set:{symbol,name,sector,exchange:'NSE',active:true}},{upsert:true}); await mongoose.disconnect(); console.log(`Seeded ${samples.length} instruments`); }
main().catch(error => { console.error(error); process.exit(1); });
