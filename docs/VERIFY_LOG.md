# VERIFY LOG — facts PRD author could not confirm. Resolved against live docs/testnet (22 Sep 2026).

| # | Item (PRD §) | Status | Finding |
|---|---|---|---|
| 1 | trade.xyz dex name + HIP-3 tickers (§5.1, §19.1) | **CONFIRMED** | Mainnet `perpDexs` → `xyz` dex, 123 HIP-3 markets. `allPerpMetas`/`meta {dex:"xyz"}` returns full list. Only ONE dex on mainnet → `hl_crossdex` yields no pairs in v1. |
| 2 | Pyth feed coverage for equities (§6.2, §19.2) | **BLOCKED** | Pyth Hermes has equity feeds (COIN, CRM, TSLA, NVDA, AAPL…) but Hermes API returns 401/unauthorized (needs key). **Workaround**: added free **Yahoo Finance** reference adapter (`fetchYahooPrice` via chart v8, no key) for US equities. |
| 3 | REST weight per info type (§5.1, §19.3) | OPEN | Assumed 1200 weight/min/IP; indexer batches via `metaAndAssetCtxs`/`allDexsAssetCtxs`, uses `meta` once at boot. Measure per-type weights on testnet. |
| 4 | Public liquidation/ADL feed (§19.4) | OPEN | Not built (v2). |
| 5 | `userFills` exact fields (§11, §19.5) | **CONFIRMED** | `coin, px, sz, side, time, startPosition, dir, closedPnl, hash, oid, crossed, fee, tid, feeToken, twapId`. `builderFee`/`liquidation` absent on standard fills (nullable in schema). |
| 6 | Koinly CSV template (§19.6, M8) | OPEN | `exportKoinly` emits Date/Sent/Received/Fee/Label. Confirm against Koinly import UI before beta. |
| 7 | HL restricted-jurisdiction list (§12, §19.7) | OPEN | Geoblock defaults `US` + `CA-ON`. |
| 8 | `approveAgent` valid_until for HIP-3 (§19.8) | OPEN | Agent name `kerb valid_until <ts>` (30d, ≤180d). Test one testnet HIP-3 order before beta. |
| 9 | Exchange calendars/holidays (§7) | OPEN | Seed values in `config/calendars/`. Verify against official sites before shipping. |
| 10 | 28 Jul 2026 tick archives (§13) | OPEN | 1h candles only (5000-candle window). Kerb snapshots make future replays exact. |
| 11 | Builder fee claim + referral totals (§5.1) | OPEN | Claim via referral reward flow; `referral` info shows totals. |
| 12 | `allDexsAssetCtxs` ctx index → coin | **CONFIRMED** | ctxs array order == `meta.universe` order. `fetchDexMetas()` builds index→coin map at boot. |
| 13 | WS `l2Book` for HIP-3 (20 levels) | **CONFIRMED** | Works on mainnet WS; real depth flowing. |
| 14 | Yahoo Finance reference (v8 chart) | **CONFIRMED** | `query1.finance.yahoo.com/v8/finance/chart/{SYM}` returns `regularMarketPrice` + `regularMarketTime` + `marketState`, no API key. Used for US equity live reference. |
| 15 | `prevDayPx` as last_close | **CONFIRMED** | Every `allDexsAssetCtxs` ctx includes `prevDayPx` → used as `last_close` reference (guarantees ≥1 reference per market). |
| 16 | Privy embedded wallet signs HL EIP-712 (approveBuilderFee/approveAgent/order) | **OPEN** | `@nktkas/hyperliquid` has first-class Privy support (`toViemAccount` → `AbstractWallet`, explicit `signTypedData` options for Privy). Code wired in `apps/web/lib/hl.ts`. **Needs a live test** with a real Privy app + funded wallet to confirm the embedded-wallet signature is accepted by HL (chainId 133 domain). |