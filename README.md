# Kerb — Self-Custodial Trading Terminal for Hyperliquid HIP-3 Perps

> **Is this price real right now, and how big can I go?**

Kerb is a self-custodial trading terminal for Hyperliquid HIP-3 perpetuals on stocks, commodities and indices. Before you sign an order, Kerb tells you three things:

1. **Is the underlying market open?** — exchange-calibrated session state (open / pre / post / overnight / closed / lunch) for KRX, NXT, TSE, TWSE, NSE, NYSE/NASDAQ and CME.
2. **Has the oracle drifted?** — Hyperliquid's oracle price vs. a composite reference (cross-dex quotes, Pyth Hermes, last cash close), expressed in basis points with staleness tracking.
3. **How much size can the book take?** — live depth budget computed by walking the L2 book from mid to your max slippage.

Revenue comes from Hyperliquid builder codes (default 4.5 bps). Kerb never touches your keys — all signing happens in the browser.

```
┌────────────────────────────────────────────┐
│              Browser (apps/web)            │
│  Next.js UI · wallet connect (main wallet) │
│  agent key generated + kept in browser     │
│  user WS streams direct to Hyperliquid     │
│  guard gate runs here before signing       │
└───────┬───────────────────────┬────────────┘
        │ public market data     │ signed actions
        │ (REST + SSE)           │ + user streams
        ▼                        ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│ apps/indexer (Node)           │   │ Hyperliquid API           │
│ · one WS set to HL public data│──▶│ POST /info, POST /exchange│
│ · reference price adapters    │   │ wss://api.hyperliquid.xyz │
│ · metrics engine (@kerb/core) │   └───────────────────────────┘
│ · session engine (@kerb/sess.)│   ┌───────────────────────────┐
│ · archiver workers            │──▶│ Reference sources         │
│ · alert dispatcher (Telegram) │   │ (adapters, see below)     │
└───────────────┬───────────────┘   └───────────────────────────┘
                ▼
        ┌──────────────┐
        │ Postgres 16  │  (Drizzle ORM)
        └──────────────┘
```

---

## ✨ What Kerb does (v1)

| Surface | Description |
|---|---|
| 📊 **Divergence Board** (`/`) | Live per-market session state, oracle vs. reference divergence, oracle staleness, book depth for every HIP-3 equity/commodity/index market. No wallet needed. |
| 💹 **Trading terminal** (`/trade`) | Connect wallet, approve the builder fee once, trade HIP-3 markets through a guarded order ticket. |
| 🛡️ **Guards** | Session-aware leverage caps, pre-session de-risk prompts, divergence-gated order signing, size budgets from live depth, liquidation-distance alerts. Every guard is labelled *information only*. |
| 🗄️ **Archiver** (`/archive`) | Continuous capture of a wallet's fills, funding and ledger updates beyond Hyperliquid's 10,000-fill window, with CSV export (generic, Koinly, KoinX-draft). |
| 🔔 **Alerts** (`/alerts`) | Telegram bot for divergence events, session transitions and liquidation-distance breaches. Drafted X posts for incidents (a human posts them). |
| 🎬 **Incident replay** (`/replay/sk-hynix-2026-07-28`) | Replay the 28 Jul 2026 SK Hynix −19% off-hours move with a "your position" leverage simulator. |

---

## 🚀 Quickstart

**Prerequisites:** Node 22+, pnpm 10+, Postgres 16 (only needed for the full indexer; the demo runs in-memory).

```bash
git clone https://github.com/zeeshan8281/kerb.git
cd kerb
cp .env.example .env        # never commit .env
pnpm install
pnpm test                   # 27 tests green
pnpm typecheck              # strict TS, all packages
```

**Run the stack:**

```bash
pnpm --filter @kerb/indexer dev    # API + SSE on :8080
pnpm --filter @kerb/web dev        # UI on :3000
```

Open http://localhost:3000 — the board works with no wallet connected.

**Verify the API:**

```bash
curl localhost:8080/healthz
curl localhost:8080/v1/markets | head -c 600
curl -N localhost:8080/v1/stream   # SSE, 1 Hz snapshots
```

---

## 🗂️ Monorepo layout

```
kerb/
  apps/
    web/            Next.js 15 App Router · React 19 · board/terminal/archive/alerts/replay
    indexer/        Fastify HTTP + SSE · WS client · archiver + alert workers
  packages/
    core/           Pure functions: divergence, staleness, depth budget, risk flags, guard decisions. No I/O.
    sessions/       Exchange calendars, DST-correct session state machine, 2026–2027 holidays.
    hl/             Thin typed wrapper over Hyperliquid REST/WS + HIP-3 helpers (asset id, dex resolution).
    refs/           Reference-price adapters behind one interface (hl_crossdex, pyth, last_close).
    db/             Drizzle schema + migration SQL, typed queries.
    exporters/      CSV exporters (generic, Koinly, KoinX-draft).
  config/
    markets.json    Hand-maintained HIP-3 coin → underlying mapping (30 seed markets)
    calendars/      Exchange hours + holidays per venue
  docs/
    VERIFY_LOG.md   Every [VERIFY] item: status + what to check before mainnet
    MARKET_MAP.md   Each mapping and its source
  fixtures/         Recorded mainnet streams for replay tests
```

**Stack:** pnpm workspaces + Turborepo · TypeScript strict · Vitest · Biome · Drizzle + Postgres 16 · Fastify · `ws` · viem (EIP-712) · Next.js 15.

---

## 📐 How the metrics work

All metrics are computed per HIP-3 coin on each asset-context update, at least once per second. Full definitions live on the `/methodology` page in the app.

| Metric | Definition |
|---|---|
| `divergenceBps` | `(oraclePx − compositeRef) / compositeRef × 10⁴` |
| `markPremiumBps` | `(markPx − oraclePx) / oraclePx × 10⁴` |
| `crossDexSpreadBps` | Max pairwise `oraclePx` difference between dexes listing the same underlying |
| `oracleStaleness` | Time since `oraclePx` last changed, plus rolling P50/P95 of update intervals over 15 min |
| `depthBudget(side, maxSlipBps)` | Largest size such that walking the current `l2Book` (20 levels) from mid gives an average fill within `maxSlipBps` of mid → `{size, notional, levelsUsed, bookExhausted}` |
| `worstOffHoursMove` | Max |%| `oraclePx` move during non-`open` sessions in stored history, floored at **19%** for Korean equities (SK Hynix, 28 Jul 2026) |
| `liqDistancePct` | `|liqPx − markPx| / markPx × 100` for a user position |

**Risk flag per market:**

```
RED    |divergence| ≥ 150 bps (DIV_RED_BPS)
       or oracle stale > 120 s (STALE_RED_MS) while underlying not open
       or session transition ≤ 5 min away with |divergence| ≥ 50 bps
AMBER  |divergence| ≥ 50 bps (DIV_AMBER_BPS)
       or underlying in {closed, overnight, pre, post}
GREEN  otherwise
```

Thresholds are env-configurable and published on the methodology page.

---

## 🛡️ Guards (evaluated in the browser, before signing)

`evaluateOrder(order, ctx)` in `packages/core` returns `allow | warn | block`:

1. **Divergence gate** — market/IOC orders on RED → `block` (override by typing `I ACCEPT DIVERGENCE RISK`); AMBER → `warn`; limit GTC/ALO → `warn` only.
2. **Size budget** — size over `depthBudget(side, yourMaxSlip)` → `warn`; over 2× → `block`.
3. **Session leverage cap** — defaults open 10×, pre/post 5×, closed/overnight/weekend 3×. Breach → `block`.
4. **Liquidation vs. worst move** — resulting `liqDistancePct < worstOffHoursMove` while not `open` → `warn` with both numbers shown.
5. **Reduce-only is never blocked.** Unit-tested explicitly.

Plus: **pre-session de-risk prompts** (15 min before `open`/`pre`, one-click reduce-only IOC), an optional **dead man's switch** via `scheduleCancel` (respects the 10/day limit), and the mandatory label on every guard: *"Information only. Kerb cannot prevent liquidation."*

---

## 🔑 Wallet & signing (browser only — the server never sees a key)

1. Connect main wallet (Privy: external + embedded).
2. Kerb checks `maxBuilderFee`. If below Kerb's fee, a one-screen explainer (fee in bps, what it pays for, revocable) requests `approveBuilderFee` — signed by the **main wallet**.
3. Kerb generates an agent keypair in the browser, encrypts it with WebCrypto (AES-GCM, key derived from a wallet signature), stores ciphertext in IndexedDB. Main wallet signs `approveAgent` with `agentName = "kerb valid_until <now+30d>"`.
4. Orders are signed by the agent key in the browser. Disconnect wipes IndexedDB.

A network capture of a full session shows no private key material leaving the browser (M6 acceptance).

---

## 📡 Reference prices

One interface, three v1 adapters (`packages/refs`):

| Adapter | Source | Cost |
|---|---|---|
| `hl_crossdex` | Same underlying listed by another HIP-3 deployer (pairs derived from `markets.json`) | Free |
| `pyth` | Pyth Hermes equity/commodity feeds | Free tier |
| `last_close` | Last official cash close, stored at session close — guarantees every market has ≥1 reference | Free (derived) |

Composite = median of live quotes (max age 60 s, 24 h for `last_close`). If only `last_close` remains, the board shows *"reference: last close only"*. A paid adapter (US: Polygon/Massive; KR: KRX/NXT) can plug into the same interface later.

---

## 🕒 Sessions

Pure function `sessionAt(calendarId, epochMs)` — DST-correct, states `closed | pre | open | lunch | post | overnight`. Calendars in `config/calendars/`:

| Calendar | TZ | Segments (local) |
|---|---|---|
| US equities | America/New_York | overnight 20:00–04:00 · pre 04:00–09:30 · open 09:30–16:00 · post 16:00–20:00 |
| KRX + NXT | Asia/Seoul | NXT pre 08:00–08:50 · KRX open 09:00–15:30 · NXT post 15:30–20:00 |
| TSE | Asia/Tokyo | open 09:00–11:30 · lunch 11:30–12:30 · open 12:30–15:30 |
| TWSE | Asia/Taipei | open 09:00–13:30 |
| NSE | Asia/Kolkata | pre 09:00–09:15 · open 09:15–15:30 |
| Commodities | America/Chicago | near-24h with daily maintenance break, weekend closed |

> ⚠️ Seed holiday data covers 2026–2027 but **must be verified against each exchange's official calendar before shipping** — tracked in `docs/VERIFY_LOG.md`.

---

## 🔌 Public API (no auth, per-IP rate limited)

```
GET  /v1/markets                        registry + session + flag (all coins)
GET  /v1/markets/:coin                  full metric snapshot
GET  /v1/markets/:coin/history?from&to&res=1s|10s|1m
GET  /v1/stream                         SSE of metric snapshots (all coins, 1 Hz)
GET  /v1/sessions/upcoming?hours=24
POST /v1/archive/register {address}     starts archiving (public HL data, no signature)
GET  /v1/archive/:address/status
GET  /v1/archive/:address/export?format=generic|koinly|koinx_draft&from&to   (signed EIP-191, nonce, 10-min expiry)
GET  /healthz                           per-worker health, WS lag, adapter health
```

**Scaling rule (hard):** user-specific streams (`clearinghouseState`, `openOrders`, `userFills`, `orderUpdates`) connect **from the browser only** — Hyperlink limits user subscriptions per IP (10 unique users/IP). Public market data connects from the server once and fans out via SSE.

---

## ⚙️ Configuration

```bash
HL_NETWORK=mainnet|testnet
KERB_BUILDER_ADDRESS=0x...
KERB_BUILDER_FEE_TENTHS_BP=45     # 4.5 bps; perp max is 100 (0.1%)
DIV_AMBER_BPS=50
DIV_RED_BPS=150
STALE_RED_MS=120000
REF_MAX_AGE_MS=60000
PYTH_HERMES_URL=https://hermes.pyth.network
DATABASE_URL=postgres://...
TELEGRAM_BOT_TOKEN=...
PUBLIC_API_RATE_LIMIT_PER_MIN=120
GEOBLOCK_COUNTRIES=US
GEOBLOCK_REGIONS=CA-ON
```

---

## 🧪 Testing

```bash
pnpm test          # 27 tests across 6 packages — all green
pnpm typecheck     # strict TS everywhere
pnpm build         # turbo build, incl. Next.js production build
```

- `packages/core`: unit tests for every metric + guard rule (reduce-only-never-blocked is explicit).
- `packages/sessions`: DST boundaries, holidays, weekends, TSE lunch break.
- Fixture replay: recorded mainnet `allDexsAssetCtxs` + `l2Book` through the metrics worker.
- Chaos: kill the HL websocket mid-stream → jittered-backoff reconnect, gap recorded in `/healthz` and bannered on the board.
- E2E: every exchange action Kerb sends is exercised on testnet first.

---

## ⚠️ Known limits & verification status

Hyperliquid specifics this implementation depends on were read from HL docs on 22 Sep 2026. Items the PRD author could not confirm are tagged **[VERIFY]** and tracked in [`docs/VERIFY_LOG.md`](docs/VERIFY_LOG.md) — check them against live docs/testnet before mainnet:

- Exact trade.xyz dex name + HIP-3 tickers; multi-dex underlyings (feeds `hl_crossdex`)
- Pyth feed/session coverage for mapped underlyings
- REST weight per info type (assumed 1200/min/IP; indexer batches via `metaAndAssetCtxs`/`allDexsAssetCtxs`)
- `userFills` exact field names (schema follows PRD; confirm against one live testnet response pre-migration)
- Koinly/KoinX CSV templates · HL restricted-jurisdiction list · `approveAgent valid_until` on HIP-3 orders
- `l2Book` 20 levels/side · `userFillsByTime` 2000/req, 10k window · `candleSnapshot` 5000 candles/interval (1m/5m for Jul 2026 is gone — the replay page uses 1h candles and says so)

---

## ⚖️ Legal & safety (enforced in code)

- **Non-custodial only.** No server-side keys, no pooled accounts, no Kerb-initiated withdrawals. Ever.
- US + Ontario geoblocked at the edge with a static page.
- No fiat on-ramp. No own markets. No claims of loss protection.
- Terms + "information only" disclaimer before first trade; acceptance stored locally, no PII server-side.
- Privacy-friendly analytics only, wallet addresses never linked to IPs server-side.
- India tax export labelled *"Draft for your CA. Tax treatment of perps in India is contested."*

---

## 🗺️ Roadmap

**v1 milestones** (build order, each gated on the previous): M0 scaffold+HL asset-id · M1 sessions · M2 stream+DB+archiver (24 h, <0.1% gap time) · M3 refs+metrics (p95 recompute <1 s) · M4 board+SSE (Lighthouse ≥85 mobile) · M5 Telegram alerts (synthetic RED → message <5 s) · M6 wallet/agent/testnet orders · M7 guards+e2e · M8 exports+replay · M9 allowlisted mainnet beta + geoblock.

**v2 (out of scope here):** conditional orders while browser is closed (pending legal), multi-venue archiver, public liquidation feed, paid reference adapters, native mobile.

Kill criteria (tracked weekly from Postgres): week 3 <2,000 board visitors · +30d <75 approved wallets or <$3M notional · day 90 <$15M/mo or <25% retention.

---

*Information only. Kerb cannot prevent liquidation.*
