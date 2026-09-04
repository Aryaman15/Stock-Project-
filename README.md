# Smart Market Watchlist backend

## Product

This backend turns a normal persistent stock watchlist into a record of what the user was actually testing. A user adds a stock, preserves why they are watching it, confirms one measurable expectation, and later sees factual evidence. The central object is the **Expectation**, not a prediction or chatbot response. Failures, absent triggers, and insufficient evidence are useful and distinct. This service gives no investment advice and makes no causal claims.

## Feature matrix

| Feature | Priority | Backend module | Primary endpoint |
|---|---|---|---|
| Normal watchlist | Green | models/app | `/watchlists`, `/instruments/search` |
| User intent + builder | Green | `services/intent` | `/items/:itemId/intents` |
| Expectations + resolver | Green | `services/domain` | `/expectations` |
| Market persistence | Green | provider/market service | `/watchlists/:id/market` |
| Timeline, replay, brief | Green | app/domain | `/timeline`, `/replay`, `/briefs` |
| Expected vs actual, Silent Story | Yellow | presentation | brief payload |
| Attention, suppression, unexplained | Yellow | attention | `/briefs/*` |
| Supersession | Yellow | domain/app | `/expectations/:id/supersede` |
| Watching Agent | Required | intent/app | `/watch-agent/sessions` |
| Orange features | Optional | — | Not implemented |

## Architecture and domain flow

```text
React frontend -> Express API -> Auth | Watchlists | Intent / Watching Agent
                              -> Expectations -> Resolver -> Timeline / Brief / Replay
                                   |                         |
                                MongoDB <--- normalized market observations
                                   ^
                              Twelve Data adapter (LIVE only)
```

Add stock → save intent → agent/compiler proposes one of three fixed templates → explicit confirmation → immutable creation snapshot → admissible observations → deterministic resolution → timeline and return brief. `src/models.ts` owns persistence; `src/services/domain.ts` owns resolution; `src/modules/market/provider.ts` isolates Twelve Data; controllers contain no market mathematics.

## No look-ahead and clocks

Every domain market read uses `{ mode: LIVE|REPLAY, asOf }`. Observations preserve `observedAt` (market fact), `ingestedAt` (received), and `availableAt` (first legitimate product use). Replay requires `availableAt <= asOf`; therefore an observation stored today for a historical date cannot change yesterday’s replay. Creation snapshots are immutable and never reconstructed. An expectation on Jan 1 replayed at Jan 6 cannot see a Jan 7 record even when it exists in MongoDB.

Models: `User`, `Instrument`, `Watchlist`, `WatchlistItem`, `UserIntent`, `MarketObservation`, `Expectation`, `ReplaySession`, `BriefState`, and `WatchAgentSession`. Watchlist item uniqueness is enforced in MongoDB. Expectation snapshots capture market evidence, provider/freshness, adjustment state, template inputs, and clock.

## Templates and outcomes

`RELATIVE_OUTPERFORMANCE` tests stock return minus benchmark return against a minimum. `PRICE_THRESHOLD` tests valid closing prices ABOVE or BELOW a numeric threshold. `BENCHMARK_PARTICIPATION` first requires a benchmark trigger, then tests stock participation. Outcomes are `CONFIRMED`, `DISCONFIRMED`, or `CONDITION_NOT_MET`; `UNSCOREABLE` means stale/missing/corporate-action-unsafe evidence. `SUPERSEDED` preserves an old expectation and links its replacement. Every result returns deterministic expected-vs-actual evidence. A failed participation expectation emits `SILENT_STORY`; `UNEXPLAINED` never invents a cause.

## Market provider

Twelve Data is the only production integration. Set `TWELVE_DATA_API_KEY`; it remains server-only. The adapter normalizes quote/historical data, chronological order, invalid credentials, rate limits, failures, stale values, and missing values. LIVE quote reads are persisted without replacing a newer available observation; REPLAY never calls the provider. Twelve Data may lack trustworthy adjusted history; the resolver intentionally returns `UNSCOREABLE` instead of fabricating performance.

## Watching Agent

The deterministic Watching Agent translates natural language only into the three supported templates, asks for missing numeric fields, and needs `/confirm` before it can create an expectation. It can read allowed watchlist/expectation evidence, expected-vs-actual, timeline, and brief. It cannot trade, predict, recommend, invent data, change snapshots/deadlines, override the resolver, or access future replay data. It is not a trading agent.

For “TCS should participate when IT rallies,” it asks for benchmark, trigger percentage, participation ratio, and deadline. Send a valid structured proposal to `/message`; `/confirm` is the explicit creation boundary.

## API reference

All APIs are under `/api/v1`; all except register/login/health need `Authorization: Bearer <JWT>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | account/JWT |
| GET | `/auth/me`, `/health` | identity/health |
| GET | `/instruments/search?q=` | search |
| POST/GET | `/watchlists` | create/list |
| GET/PATCH/DELETE | `/watchlists/:id` | owned CRUD |
| POST/DELETE | `/watchlists/:id/items` | add/remove |
| GET | `/watchlists/:id/market` | normalized market view |
| POST | `/watchlists/:watchlistId/items/:itemId/intents` | intent/compiler |
| POST | `/watchlists/:watchlistId/items/:itemId/expectations` | create expectation |
| GET | `/expectations/:id`, `/watchlists/:id/expectations` | read/filter |
| POST | `/expectations/:id/resolve`, `/expectations/:id/supersede` | resolve/replace |
| GET | `/expectations/:id/timeline` | replay-aware evidence |
| POST/GET | `/replay/sessions`, `/replay/sessions/:id` | replay session |
| POST | `/replay/sessions/:id/advance` | advance clock |
| GET/PATCH | `/briefs/return`, `/briefs/:expectationId/state` | return experience/ack |
| GET | `/briefs/suppressed` | suppression reasons |
| POST/GET | `/watch-agent/sessions`, `/watch-agent/sessions/:id` | agent session |
| POST | `/watch-agent/sessions/:id/message|confirm|cancel` | bounded agent flow |

Examples: register `{ "name":"A", "email":"a@x.com", "password":"secret123" }`; add item `{ "instrumentId":"<id>", "reason":"IT thesis" }`; intent `{ "rawText":"TCS should participate when IT rallies" }`; price expectation `{ "template":"PRICE_THRESHOLD", "direction":"ABOVE", "threshold":1750, "deadlineTradingDays":3 }`; replay `{ "watchlistId":"<id>", "asOf":"2025-01-10T00:00:00Z" }`. Errors are `{ "error": { "code":"...", "message":"...", "requestId":"..." } }`.

## Frontend integration flow

Login → load/create watchlist → search/add stock → display `/market` → ask why → save intent/create agent session → render clarification/proposal → explicitly confirm → render pending expectation/timeline → render resolution and expected-vs-actual → fetch/acknowledge return brief → create/advance replay session for historical demo.

## Setup, testing, deployment

Copy `.env.example` to `.env`. Configure `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`, `NSE_HOLIDAYS`, `TWELVE_DATA_API_KEY`, and `TWELVE_DATA_BASE_URL`.

```powershell
npm install
Copy-Item .env.example .env
# configure MongoDB and JWT_SECRET
npm run seed:instruments
npm run dev
npm test
npm run build
npm start
```

Tests use isolated `mongodb-memory-server` and never call Twelve Data. `/api/v1/health` truthfully returns `degraded` without MongoDB. Deploy one Node service plus MongoDB Atlas, configured CORS origin, environment values, and health monitoring. Demo: add TCS, create a participation expectation, advance replay, resolve, and show its Silent Story, timeline, brief, and suppression reason.

## Limitations

Provider freshness and adjusted historical coverage vary. Unsafe evidence is deliberately unscoreable. There is no trading, prediction, causal analysis, streaming, or external LLM dependency.
