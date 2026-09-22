# VERIFY LOG — facts PRD author could not confirm. Resolved against live docs/testnet where noted, else OPEN.

| # | Item (PRD §) | Status 22 Sep 2026 | Finding |
|---|---|---|---|
| 1 | trade.xyz dex name + HIP-3 tickers; multi-dex underlyings (§5.1, §19.1) | **CONFIRMED** | Mainnet `perpDexs` returns `xyz` dex with 123 HIP-3 markets (TSLA, NVDA, AAPL, MSFT, SKHX=000660, etc.). `allPerpMetas` confirms. Only ONE dex (xyz) on mainnet → `hl_crossdex` yields no pairs in v1. |
| 2 | Pyth feed coverage + session coverage for KR/JP/US equities (§6.2, §19.2) | **PARTIAL** | Pyth Hermes has equity feeds (COIN, CRM, TSLA, NVDA, AAPL, MSFT, etc.) with US market hours schedule. **BUT** Hermes API returns 401/unauthorized - likely needs API key or rate limited. v1 falls back to `last_close` only; board shows "reference: last close only". |
| 3 | REST weight per info type (§5.1, §19.3) | OPEN | Assumed 1200 weight/min/IP; indexer batches via `metaAndAssetCtxs`/`allDexsAssetCtxs`. Measure per-type weights on testnet. |
| 4 | Public liquidation/ADL feed for other users (§19.4) | OPEN | Not built (v2). No reliance in v1. |
| 5 | `userFills` exact fields: tid/dir/closedPnl/builderFee/liquidation (§11, §19.5) | **PARTIAL** | Live response fields: `coin, px, sz, side, time, startPosition, dir, closedPnl, hash, oid, crossed, fee, tid, feeToken, twapId`. **Missing**: `builderFee`, `liquidation` (likely only present on builder-fee fills or liquidation events). Schema handles as nullable. |
| 6 | Koinly CSV template; KoinX import format (§19.6, M8) | OPEN | `exportKoinly` emits Date/Sent/Received/Fee/Label columns (custom-file shape). Confirm against Koinly app import before beta. KoinX export labelled draft. |
| 7 | HL restricted-jurisdiction list (§12, §19.7) | OPEN | Edge geoblock defaults `US` + `CA-ON`; mirror HL list once confirmed. |
| 8 | `approveAgent` + `valid_until` identical for HIP-3 dex orders (§19.8) | OPEN | Agent name `kerb valid_until <ts>` (30d, ≤180d max). Test one HIP-3 order on testnet with agent key before beta. |
| 9 | Exchange calendars/holidays (§7 seed values) | OPEN | Calendars in `config/calendars/` are seed values — verify each against the official exchange site before shipping. |
| 10 | 28 Jul 2026 tick archives (§13 replay note) | OPEN | No tick source found yet; replay uses 1h candles + 19% reference floor and says so. Kerb snapshots make future replays exact. |
| 11 | Builder fee claim flow + referral totals (§5.1) | OPEN | Claim via referral reward flow; totals via `referral` info. Confirm on testnet with builder address. |
| 12 | `allDexsAssetCtxs` ctx array index → coin mapping | **CONFIRMED** | ctxs array order matches `meta.universe` order for each dex. Implemented `fetchDexMetas()` at startup to build `dexIndexToCoin` map. Working in production indexer. |
| 13 | WS `l2Book` subscription for HIP-3 coins | **CONFIRMED** | Works on mainnet WS. Returns 20 levels/side. Real depth data flowing (depthBid/depthAsk non-zero). |
| 14 | WS `allDexsAssetCtxs` includes all dexes | **CONFIRMED** | Mainnet WS returns ctxs for all dexes (xyz, abcd, cash, flx, hyna, io, km, mkts, para, vntl). Indexer filters to mapped dexes via `dexIndexToCoin`. |