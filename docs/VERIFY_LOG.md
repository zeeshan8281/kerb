# VERIFY LOG — facts PRD author could not confirm. Resolved against live docs/testnet where noted, else OPEN.

| # | Item (PRD §) | Status 22 Sep 2026 | Finding |
|---|---|---|---|
| 1 | trade.xyz dex name + HIP-3 tickers; multi-dex underlyings (§5.1, §19.1) | OPEN | Query `perpDexs` + `allPerpMetas` on mainnet; seed `config/markets.json` covers 30 markets by dayNtlVlm. Multi-dex pairs auto-derived via `crossDexPairs`. |
| 2 | Pyth feed coverage + session coverage for KR/JP/US equities (§6.2, §19.2) | OPEN | `fetchPythPrice` wired to Hermes; no paid source in v1. Board shows "reference: last close only" when Pyth/crossdex absent. Verify each mapped symbol has a Pyth price id before claiming coverage. |
| 3 | REST weight per info type (§5.1, §19.3) | OPEN | Assumed 1200 weight/min/IP; indexer batches via `metaAndAssetCtxs`/`allDexsAssetCtxs`. Measure per-type weights on testnet. |
| 4 | Public liquidation/ADL feed for other users (§19.4) | OPEN | Not built (v2). No reliance in v1. |
| 5 | `userFills` exact fields: tid/dir/closedPnl/builderFee/liquidation (§11, §19.5) | OPEN | Schema in `packages/db` follows PRD names; `normalizeFill` maps string numerics. Confirm against one live testnet `userFillsByTime` response before first migration. |
| 6 | Koinly CSV template; KoinX import format (§19.6, M8) | OPEN | `exportKoinly` emits Date/Sent/Received/Fee/Label columns (custom-file shape). Confirm against Koinly app import before beta. KoinX export labelled draft. |
| 7 | HL restricted-jurisdiction list (§12, §19.7) | OPEN | Edge geoblock defaults `US` + `CA-ON`; mirror HL list once confirmed. |
| 8 | `approveAgent` + `valid_until` identical for HIP-3 dex orders (§19.8) | OPEN | Agent name `kerb valid_until <ts>` (30d, ≤180d max). Test one HIP-3 order on testnet with agent key before beta. |
| 9 | Exchange calendars/holidays (§7 seed values) | OPEN | Calendars in `config/calendars/` are seed values — verify each against the official exchange site before shipping. |
| 10 | 28 Jul 2026 tick archives (§13 replay note) | OPEN | No tick source found yet; replay uses 1h candles + 19% reference floor and says so. Kerb snapshots make future replays exact. |
| 11 | Builder fee claim flow + referral totals (§5.1) | OPEN | Claim via referral reward flow; totals via `referral` info. Confirm on testnet with builder address. |
