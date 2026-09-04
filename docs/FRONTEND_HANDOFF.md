# Frontend handoff

Every route is under `/api/v1`; authenticated calls use `Authorization: Bearer <token>`. The frontend flow is login → watchlists → instrument search/add → `/watchlists/:id/market` → save raw intent → create Watch Agent session → show clarification/proposal → explicit agent confirmation → expectation/timeline → return brief acknowledgement → replay.

Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`. Watchlists: CRUD `/watchlists`, add/remove `/watchlists/:id/items`, market `/watchlists/:id/market`; search `GET /instruments/search?q=INFY`. Market items include `symbol`, `name`, `exchange`, `sector`, `latestPrice`, `dayChange`, `dayChangePct`, `observedAt`, `ingestedAt`, `availableAt`, `freshness`, and `provider`.

Save intent with `POST /watchlists/:watchlistId/items/:itemId/intents` body `{ "rawText":"..." }`, optionally `structuredTemplate`. Create expectations at `POST /watchlists/:watchlistId/items/:itemId/expectations` using only `RELATIVE_OUTPERFORMANCE`, `PRICE_THRESHOLD`, or `BENCHMARK_PARTICIPATION`; pass optional `{ "clock": { "mode":"REPLAY", "asOf":"..." } }`. Read/filter at `/expectations/:id` and `/watchlists/:id/expectations?status=&outcome=&template=`, resolve with `POST /expectations/:id/resolve`, supersede with `POST /expectations/:id/supersede`, and render `GET /expectations/:id/timeline`.

Replay: `POST /replay/sessions`, `GET /replay/sessions/:id`, `POST /replay/sessions/:id/advance`. Brief: `GET /briefs/return`, `GET /briefs/suppressed`, `PATCH /briefs/:expectationId/state` body `{ "state":"ACKNOWLEDGED" }`. Agent: `POST /watch-agent/sessions`, `POST /watch-agent/sessions/:id/message`, then `POST /watch-agent/sessions/:id/confirm` or `/cancel`; no expectation is created before confirmation.

Errors always use `{ "error": { "code":"VALIDATION_ERROR", "message":"...", "requestId":"..." } }`. In REPLAY always preserve the returned clock and send it to clock-aware views; future `availableAt` data is deliberately excluded.
