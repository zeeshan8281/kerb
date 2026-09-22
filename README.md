# Kerb

**The self-custodial trading terminal for Hyperliquid HIP-3 perps — with a live divergence board that actually works.**

> Is this price real right now, and how big can I go?

Kerb watches every Hyperliquid HIP-3 stock, commodity and index market in real time and answers the three questions that matter before you sign an order:

1. **Is the underlying market open?** — exchange-calibrated session state (open · pre · post · lunch · overnight · closed) for KRX, NXT, TSE, TWSE, NSE, NYSE/NASDAQ and CME.
2. **Has the oracle drifted?** — Hyperliquid's oracle vs. a live composite reference (Yahoo Finance for US names, `prevDayPx` last-close for everything else), in basis points with staleness tracking.
3. **How much size can the book take?** — a depth budget from walking the live L2 book (20 levels) from mid to your max slippage.

Kerb is non-custodial. Keys never leave the browser. Revenue is Hyperliquid builder fees (default 4.5 bps).

---

## ✅ Status: the market-data core is live

The indexer connects to **Hyperliquid mainnet**, streams `allDexsAssetCtxs` + `l2Book`, computes divergence against real reference prices, persists to Postgres, and serves the board over SSE. Running it now produces real, sane numbers:

```
xyz:TSLA    oracle 376.26  ref 375.30 (yahoo)     div +25.6 bps  AMBER
xyz:NVDA    oracle 226.06  ref 227.38 (yahoo)     div -58.1 bps  AMBER
xyz:COIN    oracle 195.44  ref 201.05 (yahoo)     div -279 bps   RED
xyz:CRCL    oracle 91.14   ref 94.49  (yahoo)     div -355 bps   RED
xyz:MSTR    oracle 163.06  ref 168.50 (yahoo)     div -322 bps   RED
xyz:SKHX    oracle 1346    ref 1356   (prevDayPx) div -55 bps    AMBER
xyz:GOLD    oracle 4313    ref 4349   (prevDayPx) div -81 bps    AMBER
```

35 HIP-3 markets, real oracle/depth/reference, correct RED/AMBER/GREEN flags.

| Piece | Status |
|---|---|
| Live HL mainnet WS (`allDexsAssetCtxs`, `l2Book`) | ✅ running |
| Reference prices (Yahoo + `prevDayPx`) | ✅ running |
| Divergence / staleness / depth / risk-flag engine | ✅ running |
| Postgres persistence | ✅ running |
| SSE board stream (1 Hz) | ✅ running |
| Archiver fill capture + CSV export | ✅ running |
| Session engine (DST-correct) | ✅ 100% unit-tested |
| Guards (divergence gate, size budget, leverage cap) | ✅ unit-tested |
| Wallet connect / agent key / testnet orders | 🟡 code wired, needs Privy + funded testnet wallet |
| Telegram alerts | 🟡 code wired, needs bot token |

---

## Quickstart

**Prereqs:** Node 22+, pnpm 10+, Postgres 16.

```bash
git clone https://github.com/zeeshan8281/kerb.git
cd kerb
cp .env.example .env              # never commit .env

# 1. Postgres — create the DB and run migrations
createdb kerb
psql -d kerb -f packages/db/drizzle/0001_init.sql

# 2. Install & verify
pnpm install
pnpm test                        # 29 tests green
pnpm typecheck                   # strict TS across all packages

# 3. Run the indexer (connects to HL mainnet WS, needs DATABASE_URL)
HL_NETWORK=testnet DATABASE_URL=postgres://localhost:5432/kerb pnpm --filter @kerb/indexer dev

# 4. Run the UI (separate terminal)
NEXT_PUBLIC_INDEXER=http://localhost:8080 pnpm --filter @kerb/web dev
```

Open **http://localhost:3000** — the board works with no wallet connected.

```bash
curl localhost:8080/healthz                     # ws connected, adapter health, coin count
curl localhost:8080/v1/markets                  # every market: session, oracle, ref, divergence, flag, depth
curl -N localhost:8080/v1/stream                # SSE, 1 Hz live snapshots
```

---

## How it works

### Architecture

```
┌────────────────────────────────────────────┐
│              Browser (apps/web)            │
│  Next.js UI · wallet connect (main wallet) │
│  agent key kept in browser (IndexedDB)     │
│  guard gate runs here before signing       │
└───────┬───────────────────────┬────────────┘
        │ REST + SSE            │ signed actions + user streams
        ▼                       ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│ apps/indexer (Node)           │   │ Hyperliquid                │
│ · one WS → HL public data     │──▶│ POST /info, POST /exchange │
│ · reference adapters (yahoo,  │   │ wss://api.hyperliquid.xyz  │
│   last_close)                 │   └───────────────────────────┘
│ · metrics engine (@kerb/core) │   ┌───────────────────────────┐
│ · session engine              │──▶│ Reference sources          │
│ · archiver + alert workers    │   │ Yahoo Finance (free)       │
└───────────────┬───────────────┘   └───────────────────────────┘
                ▼
        ┌──────────────┐
        │ Postgres 16  │  (Drizzle ORM)
        └──────────────┘
```

### Metrics (`@kerb/core`, pure functions)

| Metric | Definition |
|---|---|
| `divergenceBps` | `(oraclePx − compositeRef) / compositeRef × 10⁴` |
| `markPremiumBps` | `(markPx − oraclePx) / oraclePx × 10⁴` |
| `oracleStaleness` | time since `oraclePx` changed + rolling P50/P95 over 15 min |
| `depthBudget(side, slip)` | max size walking `l2Book` from mid within slip → `{size, notional, levelsUsed, bookExhausted}` |
| `worstOffHoursMove` | max % oracle move off-session, floored at 19% for Korean equities |
| `liqDistancePct` | `|liqPx − markPx| / markPx × 100` |

**Risk flag**

```
RED    |divergence| ≥ 150 bps · or stale >120s off-session · or transition ≤5min with |div|≥50
AMBER  |divergence| ≥ 50 bps · or underlying in {closed, overnight, pre, post}
GREEN  otherwise
```

### Reference prices

One interface, adapters behind it (`packages/refs`). **What's live now:** `yahoo` (US equities, free, no key — via Yahoo chart v8) and `last_close` (Hyperliquid's own `prevDayPx`, so every market has a reference). Pyth Hermes returns 401 without a key, and `hl_crossdex` needs a second HIP-3 deployer — both slot into the same interface later. A paid adapter (Polygon, KRX/NXT) plugs in the same way.

Composite = median of live quotes (60s max age, `last_close` 24h). Board shows *"reference: last close only"* when that's all it has.

---

## Guards

`evaluateOrder(order, ctx)` in `@kerb/core` → `allow | warn | block`, evaluated in the browser before signing:

1. **Divergence gate** — market/IOC on RED → `block` (override phrase `I ACCEPT DIVERGENCE RISK`); AMBER → `warn`.
2. **Size budget** — size > `depthBudget` → `warn`; > 2× → `block`.
3. **Session leverage cap** — open 10×, pre/post 5×, off-hours 3×; breach → `block`.
4. **Liquidation vs worst move** — `liqDistancePct < worstOffHoursMove` while not open → `warn`.
5. **Reduce-only never blocked** (explicitly unit-tested).

Every guard is labelled *information only — Kerb cannot prevent liquidation.*

---

## Repo layout

```
apps/
  web/            Next.js 15 · board / trade / replay / archive / alerts / methodology
  indexer/        Fastify HTTP + SSE · mainnet WS client · archiver + alert workers
packages/
  core/           pure metric + guard functions (no I/O)
  sessions/       DST-correct calendars + holidays (2026–2027)
  hl/             typed Hyperliquid REST/WS wrapper + HIP-3 asset-id helpers
  refs/           reference adapters (yahoo, prev_close, pyth, hl_crossdex)
  db/             Drizzle schema + migration SQL
  exporters/      generic + Koinly + KoinX-draft CSV
config/
  markets.json    HIP-3 coin → underlying mapping (35 markets, validated at boot)
  calendars/      per-venue hours + holidays
docs/
  VERIFY_LOG.md   15 [VERIFY] items resolved against live HL (status + finding)
  MARKET_MAP.md   full mapping table
```

**Stack:** pnpm workspaces + Turborepo · TypeScript strict · Vitest · Biome · Drizzle + Postgres 16 · Fastify · `ws` · Next.js 15 · viem.

---

## Public API

```
GET  /v1/markets                             all coins + session + flag + divergence + depth
GET  /v1/markets/:coin                       full snapshot
GET  /v1/stream                              SSE, 1 Hz
POST /v1/archive/register {address}          start archiving (public data, no sig)
GET  /v1/archive/:address/export?format=…    generic | koinly | koinx_draft
GET  /healthz                                ws / adapter / DB health
```

**Archiver:** backfills and keeps capturing beyond HL's 10,000-fill window via paginated `userFillsByTime` (2000/req), idempotent upserts.

**Hard rule:** user streams (`clearinghouseState`, `openOrders`, `userFills`, `orderUpdates`) connect from the **browser only** (HL caps user subs at 10 unique users/IP). Public data connects from the server once and fans out over SSE.

---

## Configuration

```bash
HL_NETWORK=mainnet|testnet
KERB_BUILDER_ADDRESS=0x...
KERB_BUILDER_FEE_TENTHS=45           # 4.5 bps (perp max 0.1%)
DIV_AMBER_BPS=50
DIV_RED_BPS=150
DATABASE_URL=postgres://localhost:5432/kerb
TELEGRAM_BOT_TOKEN=                  # alerts (optional)
GEOBLOCK_COUNTRIES=US
GEOBLOCK_REGIONS=CA-ON
```

---

## Testing

```bash
pnpm test           # 29 tests across 6 packages
pnpm typecheck      # strict TS everywhere
pnpm build          # turbo, incl. Next.js prod build
```

- `@kerb/core`: every metric + guard rule (reduce-only-never-blocked, RED blocks market, 2× budget blocks, leverage cap blocks).
- `@kerb/sessions`: DST boundaries, holidays, weekends, TSE lunch break.
- `@kerb/hl`: HIP-3 asset-id formula + coin parsing.
- `@kerb/refs`: median composite, last-close-only flag, stale-quote discard.
- Chaos: killing the HL WS mid-stream reconnects with jittered backoff and marks the gap in `/healthz`.

---

## Legal & safety (enforced in code)

- **Non-custodial.** No server keys, no pooled accounts, no Kerb-initiated withdrawals.
- US + Ontario geoblocked at the edge.
- No fiat on-ramp. No own markets. No loss-protection claims.
- Terms + "information only" disclaimer before first trade; stored locally, no PII server-side.
- India tax export labelled *"Draft for your CA. Tax treatment of perps in India is contested."*

---

## Verification

All 15 facts the original PRD author couldn't confirm are tracked in [`docs/VERIFY_LOG.md`](docs/VERIFY_LOG.md) with live status (confirmed / blocked / open). Highlights:

- **Confirmed** `xyz` dex with 123 HIP-3 markets; `allDexsAssetCtxs` index↔coin mapping.
- **Blocked** Pyth Hermes (401) → solved with the free Yahoo adapter.
- **Confirmed** `userFillsByTime` field names.

---

*Information only. **Kerb cannot prevent liquidation.***