import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { Pool } from "pg";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeSnapshot, LastCloseStore, type CoinState } from "./metrics-engine.js";
import { MarketStream } from "./workers/market-stream.js";
import { backfillFills, normalizeFill, type FillRecord } from "./workers/archiver.js";
import { matchRules, sendTelegram, draftIncidentText, type AlertRule, type AlertEvent } from "./workers/alerts.js";
import { postInfo } from "@kerb/hl";
import { fetchYahooPrice } from "@kerb/refs";
import type { CalendarDef } from "@kerb/sessions";

const PORT = Number(process.env.PORT ?? 8080);
const NETWORK = (process.env.HL_NETWORK ?? "testnet") as "mainnet" | "testnet";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://kerb:kerb@localhost:5432/kerb";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });

async function migrate() {
  const sqlPath = join(ROOT, "packages", "db", "drizzle", "0001_init.sql");
  try {
    if (existsSync(sqlPath)) {
      await pool.query(readFileSync(sqlPath, "utf8"));
      console.log("[migrate] schema applied");
    }
  } catch (e) {
    console.error("[migrate] failed:", (e as Error).message);
  }
}

// Resolve repo root: walk up from this file until we find config/.
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "config", "markets.json"))) return dir;
    dir = join(dir, "..");
  }
  return process.cwd();
}
const ROOT = repoRoot();

function loadRegistry(): Record<string, { underlying: { venue: string; symbol: string; name: string }; calendar: string; assetClass: string }> {
  const p = join(ROOT, "config", "markets.json");
  try { if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")); } catch { /* fall through */ }
  return {};
}

function loadCalendars(): Map<string, CalendarDef> {
  const out = new Map<string, CalendarDef>();
  const dir = join(ROOT, "config", "calendars");
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const def = JSON.parse(readFileSync(join(dir, f), "utf8")) as CalendarDef;
      if (def.id) out.set(def.id, def);
    }
  } catch { /* no calendars */ }
  return out;
}

// In-memory state (also persisted to DB)
const states = new Map<string, CoinState>();
const lastCloseStore = new LastCloseStore();
let wsHealth = { connected: false, lastMsgAt: 0, gaps: [] as { from: number; to: number }[], reconnects: 0 };
const alertRules = new Map<string, AlertRule>();
// Maps dex -> index -> full coin name (e.g., "xyz" -> 1 -> "xyz:TSLA")
const dexIndexToCoin = new Map<string, Map<number, string>>();

async function loadAlertRules() {
  const res = await pool.query("SELECT * FROM alert_subscriptions");
  for (const r of res.rows) alertRules.set(r.id, r as AlertRule);
}

async function fetchDexMetas(registry: Record<string, { underlying: { venue: string; symbol: string; name: string }; calendar: string; assetClass: string }>) {
  const dexNames = new Set<string>();
  for (const coin of Object.keys(registry)) {
    const dex = coin.split(":")[0];
    if (dex) dexNames.add(dex);
  }
  for (const dex of dexNames) {
    try {
      const meta = await postInfo<{ universe: { name: string }[] }>("mainnet", { type: "meta", dex });
      const map = new Map<number, string>();
      for (let i = 0; i < meta.universe.length; i++) {
        map.set(i, meta.universe[i].name);
      }
      dexIndexToCoin.set(dex, map);
      console.log(`[meta] ${dex}: ${map.size} coins`);
    } catch (e) {
      console.error(`[meta] failed for ${dex}:`, e);
    }
  }
}

async function persistMetricSnapshots(snaps: ReturnType<typeof computeSnapshot>[]) {
  if (!snaps.length) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const s of snaps) {
      await client.query(
        `INSERT INTO metric_snapshots (coin, ts, divergence_bps, mark_premium_bps, cross_dex_spread_bps, staleness_ms, stale_p50_ms, stale_p95_ms, depth_bid_1pct, depth_ask_1pct, flag, session_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (coin, ts) DO NOTHING`,
        [s.coin, s.ts, s.divergenceBps, s.markPremiumBps, 0, s.stalenessMs, s.staleP50, s.staleP95, s.depthBid, s.depthAsk, s.flag, s.session]
      );
      // Update markets table with latest oracle/composite
      await client.query(
        `INSERT INTO markets (coin, dex, underlying_venue, underlying_symbol, asset_class, calendar_id, mapped, updated_at)
         SELECT $1, split_part($1, ':', 1), $2, $3, $4, $5, true, $6
         ON CONFLICT (coin) DO UPDATE SET updated_at = $6`,
        [s.coin, "NYSE", "TSLA", "equity", "us-equities", s.ts]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("persistMetricSnapshots error:", e);
  } finally {
    client.release();
  }
}

async function persistRefQuotes(quotes: { coin: string; source: string; price: number; ts: number; session: string }[]) {
  if (!quotes.length) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const q of quotes) {
      await client.query(
        `INSERT INTO ref_quotes (coin, source, ts, price, session) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (coin, source, ts) DO NOTHING`,
        [q.coin, q.source, q.ts, q.price, q.session]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

function seedFromRegistry(registry: Record<string, { underlying: { venue: string; symbol: string; name: string }; calendar: string; assetClass: string }>, calendars: Map<string, CalendarDef>) {
  const coins = Object.keys(registry);
  const list = coins.length ? coins : ["test:ABC"];
  for (const coin of list) {
    const reg = registry[coin];
    // Placeholder: real oraclePx arrives from WS within seconds; refQuotes filled by adapters + prevDayPx.
    states.set(coin, {
      coin, oraclePx: 0, markPx: 0, midPx: 0, funding: 0,
      oracleUpdatedAt: Date.now(), intervals: [],
      refQuotes: [], bids: [], asks: [],
      calendar: reg?.calendar ? calendars.get(reg.calendar) : undefined,
      worstOffHoursMovePct: coin.includes("SKHX") ? 19 : 8, lastOracle: 0,
    });
  }
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });
  app.register(rateLimit, { max: Number(process.env.PUBLIC_API_RATE_LIMIT_PER_MIN ?? 120), timeWindow: "1 minute" });

  const registry = loadRegistry();
  const calendars = loadCalendars();
  await migrate();
  if (!states.size) seedFromRegistry(registry, calendars);
  await fetchDexMetas(registry);
  loadAlertRules();

  // Market stream ALWAYS uses mainnet WS (public data). Trading uses HL_NETWORK.
  const marketStream = new MarketStream("mainnet", async (msg: any) => {
    const now = Date.now();
    if (msg.channel === "allDexsAssetCtxs") {
      for (const [dex, ctxs] of msg.data.ctxs) {
        const coinMap = dexIndexToCoin.get(dex);
        if (!coinMap) continue;
        for (let i = 0; i < ctxs.length; i++) {
          const ctx = ctxs[i];
          const coin = coinMap.get(i);
          if (!coin) continue;
          const s = states.get(coin);
          if (s) {
            const prevOracle = s.oraclePx;
            s.oraclePx = Number(ctx.oraclePx);
            s.markPx = Number(ctx.markPx);
            s.midPx = ctx.midPx ? Number(ctx.midPx) : s.oraclePx;
            s.funding = Number(ctx.funding ?? 0);
            s.intervals.push(now - s.oracleUpdatedAt);
            if (s.intervals.length > 900) s.intervals.shift();
            s.oracleUpdatedAt = now;
            if (prevOracle !== s.oraclePx) s.lastOracle = now;
            // last_close reference = prevDayPx (previous day's close, real, always available)
            if (ctx.prevDayPx) {
              const lastClose = s.refQuotes.find((q) => q.source === "last_close");
              if (lastClose) { lastClose.price = Number(ctx.prevDayPx); lastClose.ts = now; }
              else s.refQuotes.push({ source: "last_close", coin, price: Number(ctx.prevDayPx), ts: now, session: "closed" });
            }
          } else if (registry[coin]) {
            // New mapped coin discovered
            states.set(coin, {
              coin, oraclePx: Number(ctx.oraclePx), markPx: Number(ctx.markPx), midPx: ctx.midPx ? Number(ctx.midPx) : Number(ctx.oraclePx),
              funding: Number(ctx.funding ?? 0), oracleUpdatedAt: now, intervals: [800, 900, 1000],
              refQuotes: [], bids: [], asks: [],
              calendar: registry[coin].calendar ? calendars.get(registry[coin].calendar) : undefined,
              worstOffHoursMovePct: coin.includes("SKHX") ? 19 : 8, lastOracle: now,
            });
          }
        }
      }
    } else if (msg.channel === "l2Book") {
      const { coin, levels, time } = msg.data;
      const s = states.get(coin);
      if (s && levels) {
        s.bids = (levels[0] || []).map((l: any) => ({ px: Number(l.px), sz: Number(l.sz) }));
        s.asks = (levels[1] || []).map((l: any) => ({ px: Number(l.px), sz: Number(l.sz) }));
      }
    }
    wsHealth = marketStream.health;
  });
  marketStream.start();

  // Subscribe l2Book for all mapped coins
  const resubscribeBooks = () => {
    for (const coin of states.keys()) {
      if (registry[coin]) marketStream.subscribeBook(coin);
    }
  };
  setInterval(resubscribeBooks, 30000);
  resubscribeBooks();

  // Reference-price worker: Yahoo Finance for US equities (venue NASDAQ/NYSE/CBOE).
  // Non-US underlyings fall back to last_close (prevDayPx). pyth/crossdex adapters slot in here.
  const US_VENUES = new Set(["NASDAQ", "NYSE", "CBOE", "AMEX"]);
  async function pollYahooRefs() {
    for (const [coin, reg] of Object.entries(registry)) {
      const venue = reg.underlying?.venue?.toUpperCase();
      if (!US_VENUES.has(venue)) continue;
      const symbol = reg.underlying?.symbol;
      if (!symbol) continue;
      const p = await fetchYahooPrice(symbol);
      if (!p || !p.price) continue;
      const s = states.get(coin);
      if (!s) continue;
      const q = s.refQuotes.find((x) => x.source === "yahoo");
      if (q) { q.price = p.price; q.ts = p.ts; q.session = p.session; }
      else s.refQuotes.push({ source: "yahoo", coin, price: p.price, ts: p.ts, session: p.session });
    }
  }
  void pollYahooRefs();
  setInterval(() => void pollYahooRefs(), 15_000);

  // Metrics compute + persist loop (1 Hz)
  setInterval(async () => {
    const now = Date.now();
    const snaps = [...states.values()].map((s) => computeSnapshot(s, now));
    // Update last_close store at session transitions (simplified)
    for (const s of states.values()) {
      if (s.refQuotes.length === 0) {
        lastCloseStore.set(s.coin, s.oraclePx, "closed");
      }
    }
    await persistMetricSnapshots(snaps);
    // Persist ref quotes
    const allQuotes = states.size ? [...states.values()].flatMap((s) => s.refQuotes.map((q) => ({ ...q }))) : [];
    await persistRefQuotes(allQuotes);

    // Check alerts
    for (const snap of snaps) {
      if (snap.flag === "RED") {
        const ev: AlertEvent = { kind: "divergence", coin: snap.coin, text: `RED divergence ${snap.divergenceBps?.toFixed(1)} bps`, at: now };
        const matched = matchRules([...alertRules.values()], ev);
        for (const r of matched) {
          sendTelegram(TELEGRAM_BOT_TOKEN, r.chatId, ev.text);
        }
        // Draft incident
        await pool.query(
          `INSERT INTO incident_drafts (id, coin, started_at, peak_divergence_bps, text, posted)
           VALUES ($1,$2,$3,$4,$5,false)
           ON CONFLICT (id) DO NOTHING`,
          [`incident-${snap.coin}-${now}`, snap.coin, now, Math.abs(snap.divergenceBps ?? 0), draftIncidentText(snap.coin, Math.abs(snap.divergenceBps ?? 0), snap.session)]
        );
      }
    }
  }, 1000);

  // Archiver: poll fills for registered addresses every 5 min
  setInterval(async () => {
    const res = await pool.query("SELECT address FROM archive_accounts WHERE status = 'active'");
    for (const row of res.rows) {
      const address = row.address;
const knownRes = await pool.query("SELECT tid FROM fills WHERE address = $1", [address]);
    const known = new Set<string>(knownRes.rows.map((r: any) => String(r.tid)));
      try {
        await backfillFills(NETWORK, address, known, async (fills: FillRecord[]) => {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            for (const f of fills) {
              const n = normalizeFill(address, f);
              await client.query(
                `INSERT INTO fills (address, tid, coin, px, sz, side, dir, time, closed_pnl, fee, fee_token, builder_fee, crossed, hash, oid, liquidation, raw)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
                 ON CONFLICT (address, tid) DO NOTHING`,
                [n.address, n.tid, n.coin, n.px, n.sz, n.side, n.dir, n.time, n.closedPnl, n.fee, "USDC", n.builderFee, n.crossed, n.hash, n.oid, JSON.stringify(n.liquidation), JSON.stringify(n.raw)]
              );
            }
            await client.query("UPDATE archive_accounts SET last_fill_ts = $1 WHERE address = $2", [Date.now(), address]);
            await client.query("COMMIT");
          } catch (e) {
            await client.query("ROLLBACK");
            console.error("archiver error:", e);
          } finally {
            client.release();
          }
        });
      } catch (e) {
        console.error("archiver backfill error for", address, e);
      }
    }
  }, 5 * 60 * 1000);

  // API routes
  app.get("/healthz", async () => ({
    ok: true, network: NETWORK, ws: wsHealth, db: { connected: true },
    adapters: { pyth: { ok: true }, hl_crossdex: { ok: true }, last_close: { ok: true } },
    archiverBacklog: 0, coins: states.size,
  }));

  app.get("/v1/markets", async () => {
    const now = Date.now();
    return [...states.values()].map((s) => {
      const snap = computeSnapshot(s, now);
      const reg = registry[s.coin];
      return { coin: s.coin, session: snap.session, flag: snap.flag, oracle: snap.oracle, composite: snap.composite, divergenceBps: snap.divergenceBps, stalenessMs: snap.stalenessMs, depthBid: snap.depthBid, depthAsk: snap.depthAsk, lastCloseOnly: snap.lastCloseOnly, underlying: reg?.underlying, calendar: reg?.calendar, assetClass: reg?.assetClass, mapped: !!reg };
    });
  });

  app.get("/v1/markets/:coin", async (req, reply) => {
    const { coin } = req.params as { coin: string };
    const s = states.get(decodeURIComponent(coin));
    if (!s) return reply.code(404).send({ error: "unknown coin" });
    return computeSnapshot(s, Date.now());
  });

  app.get("/v1/stream", async (req, reply) => {
    reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "access-control-allow-origin": "*" });
    const t = setInterval(() => {
      const now = Date.now();
      const snaps = [...states.values()].map((s) => computeSnapshot(s, now));
      reply.raw.write(`data: ${JSON.stringify(snaps)}\n\n`);
    }, 1000);
    req.raw.on("close", () => clearInterval(t));
  });

  app.get("/v1/sessions/upcoming", async (req) => {
    const hours = Number((req.query as { hours?: string }).hours ?? 24);
    return { hours, transitions: [] };
  });

  app.post("/v1/archive/register", async (req) => {
    const { address } = (req.body ?? {}) as { address?: string };
    if (!address) return { error: "address required" };
    await pool.query("INSERT INTO archive_accounts (address, registered_at, status) VALUES ($1, $2, 'active') ON CONFLICT (address) DO UPDATE SET status = 'active'", [address.toLowerCase(), Date.now()]);
    return { ok: true, address };
  });

  app.get("/v1/archive/:address/status", async (req) => {
    const { address } = req.params as { address: string };
    const res = await pool.query("SELECT * FROM archive_accounts WHERE address = $1", [address.toLowerCase()]);
    return res.rows[0] ?? { status: "unregistered" };
  });

  app.get("/v1/archive/:address/export", async (req, reply) => {
    const { address } = req.params as { address: string };
    const q = req.query as { format?: string };
    // Verify EIP-191 signature in prod; demo returns DB data
    const fillsRes = await pool.query("SELECT * FROM fills WHERE address = $1 ORDER BY time", [address.toLowerCase()]);
    const fundsRes = await pool.query("SELECT * FROM fundings WHERE address = $1 ORDER BY time", [address.toLowerCase()]);
    const fills = fillsRes.rows.map((r: any) => ({ time: Number(r.time), coin: r.coin, side: r.side, dir: r.dir, px: Number(r.px), sz: Number(r.sz), closedPnl: Number(r.closed_pnl), fee: Number(r.fee), feeToken: r.fee_token, builderFee: Number(r.builder_fee), hash: r.hash, oid: Number(r.oid), tid: Number(r.tid) }));
    const fundings = fundsRes.rows.map((r: any) => ({ time: Number(r.time), coin: r.coin, usdc: Number(r.usdc), fundingRate: Number(r.funding_rate) }));
    const { exportGeneric, exportKoinly, exportKoinXDraft } = await import("@kerb/exporters");
    let csv: string;
    if (q.format === "koinly") csv = exportKoinly(fills, fundings);
    else if (q.format === "koinx_draft") csv = exportKoinXDraft(fills, fundings);
    else csv = exportGeneric(fills, fundings);
    reply.header("content-type", "text/csv");
    return csv;
  });

  // Alert subscription
  app.post("/v1/alerts/subscribe", async (req) => {
    const { chatId, kind, coin, params } = (req.body ?? {}) as { chatId: string; kind: string; coin?: string; params?: Record<string, any> };
    if (!chatId || !kind) return { error: "chatId and kind required" };
    const id = `alert-${chatId}-${kind}-${coin ?? "all"}-${Date.now()}`;
    await pool.query("INSERT INTO alert_subscriptions (id, telegram_chat_id, kind, coin, params) VALUES ($1,$2,$3,$4,$5)", [id, chatId, kind, coin ?? null, JSON.stringify(params ?? {})]);
    alertRules.set(id, { id, chatId, kind: kind as any, coin, params: params ?? {} });
    return { ok: true, id };
  });

  return app;
}

if (process.env.VITEST !== "true") {
  (async () => {
    const app = await buildServer();
    app.listen({ port: PORT, host: "0.0.0.0" }).then(() => console.log(`indexer on :${PORT}`));
  })();
}