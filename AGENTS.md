# Working rules

Expectation is the central domain object. Creation snapshots are immutable. Every domain market read uses an explicit LIVE or REPLAY clock and only reads observations with `availableAt <= clock.asOf`. `observedAt`, `ingestedAt`, and `availableAt` are distinct; historical EOD bars may be backfilled later but become admissible at their legitimate market-publication time. Trading deadlines use `TradingCalendar`; data without a trustworthy provider adjusted close is `UNSAFE` and resolves as `UNSCOREABLE`. Use observational language only—never causal claims.
