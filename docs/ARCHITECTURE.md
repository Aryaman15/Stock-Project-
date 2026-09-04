# Architecture

Feature routes sit in `src/app.ts`; Mongoose persistence is in `src/models.ts`; domain decision logic is in `src/services/domain.ts`. The provider adapter is isolated under `src/modules/market`. The admissible-read query prevents look-ahead: it requires both `observedAt <= clock.asOf` and `ingestedAt <= clock.asOf`. Deadlines use configurable NSE holidays. Safe comparisons require adjustment-safe, non-stale observations; otherwise the result is `UNSCOREABLE`.
