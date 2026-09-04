# Working rules

Expectation is the central domain object. Creation snapshots are immutable. Every domain market read uses an explicit LIVE or REPLAY clock and only reads observations admissible at that clock (both observed and ingested by then). `observedAt` and `ingestedAt` are distinct. Trading deadlines use `TradingCalendar`; corporate-action-unsafe data resolves as `UNSCOREABLE`. Use observational language only—never causal claims.
