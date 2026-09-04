import mongoose from 'mongoose'; import { app } from './app.js'; import { env } from './config/env.js';
mongoose.connect(env.MONGODB_URI).then(() => app.listen(env.PORT, () => console.log(`Smart Market Watchlist API listening on ${env.PORT}`))).catch(err => { console.error('Database connection failed', err.message); process.exit(1); });
