import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { readFileSync, existsSync } from "node:fs";
import { computeSnapshot, type CoinState } from "./metrics-engine.js";

const PORT = Number(process.env.PORT ?? 8080);
const NETWORK = (process.env.HL_NETWORK ?? "mainnet") as "mainnet" | "testnet";

function loadRegistry(): Record<string, { underlying: { venue: string; symbol: string; name: string }; calendar: string; assetClass: string }> {
  for (const p of ["../../config/markets.json", "./config/markets.json", "/Users/zeeshan/kerb/config/markets.json"]) {
    try { if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")); } catch { /* next */ }
  }
  return {};
}
// In-memory demo state (DB-backed in prod; same shape)
const states = new Map<string, CoinState>();
function seedDemo(registry: Record<string, { underlying: { venue: string; symbol: string } }>) {
  const coins = Object.keys(registry);
  const list = coins.length ? coins : ["xyz:TSLA", "xyz:NVDA", "xyz:SKHX"];
  let i = 0;
  for (const coin of list) {
    const base = 100 + i * 37;
    states.set(coin, {
      coin, oraclePx: base, markPx: base * 1.0004, midPx: base, funding: 0.0001,
      oracleUpdatedAt: Date.now(), intervals: [800, 900, 1000],
      refQuotes: [
        { source: "last_close", coin, price: base * 0.995, ts: Date.now(), session: "closed" },
        { source: "pyth", coin, price: base * 1.001, ts: Date.now(), session: "open" },
      ],
      bids: [{ px: base - 0.1, sz: 5 }, { px: base - 0.3, sz: 10 }],
      asks: [{ px: base + 0.1, sz: 5 }, { px: base + 0.3, sz: 10 }],
      worstOffHoursMovePct: coin.includes("SKHX") ? 19 : 8, lastOracle: base,
    });
    i++;
  }
}
// Simulate live ticks so the board moves without HL creds
setInterval(() => {
  const now = Date.now();
  for (const s of states.values()) {
    const drift = (Math.random() - 0.5) * s.oraclePx * 0.0004;
    s.intervals.push(900 + Math.random() * 300);
    s.oraclePx += drift; s.markPx = s.oraclePx * (1 + (Math.random() - 0.5) * 0.0004);
    s.oracleUpdatedAt = now;
    s.refQuotes = s.refQuotes.map((q) => (q.source === "pyth" ? { ...q, price: q.price + (Math.random() - 0.5) * 0.05, ts: now } : q));
  }
}, 2000);

export function buildServer() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });
  app.register(rateLimit, { max: Number(process.env.PUBLIC_API_RATE_LIMIT_PER_MIN ?? 120), timeWindow: "1 minute" });
  const registry = loadRegistry();
  if (!states.size) seedDemo(registry);

  app.get("/healthz", async () => ({
    ok: true, network: NETWORK, ws: { connected: true, lastMsgAgeMs: 400 },
    adapters: { pyth: { ok: true }, hl_crossdex: { ok: true }, last_close: { ok: true } },
    archiverBacklog: 0, coins: states.size,
  }));
  app.get("/v1/markets", async () => {
    const now = Date.now();
    return [...states.values()].map((s) => {
      const snap = computeSnapshot(s, now);
      const reg = (registry as Record<string, { underlying: { venue: string; symbol: string; name: string }; calendar: string; assetClass: string }>)[s.coin];
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
    return { hours, transitions: [{ coin: "xyz:SKHX", from: "closed", to: "pre", at: Date.now() + 15 * 60_000 }] };
  });
  const archives = new Map<string, { status: string; fills: number }>();
  app.post("/v1/archive/register", async (req) => {
    const { address } = (req.body ?? {}) as { address?: string };
    if (!address) return { error: "address required" };
    archives.set(address.toLowerCase(), { status: "active", fills: 0 });
    return { ok: true, address };
  });
  app.get("/v1/archive/:address/status", async (req) => {
    const { address } = req.params as { address: string };
    return archives.get(address.toLowerCase()) ?? { status: "unregistered" };
  });
  app.get("/v1/archive/:address/export", async (req, reply) => {
    const { address } = req.params as { address: string };
    const q = req.query as { format?: string };
    // Export requires signature in prod (EIP-191 nonce check); demo returns sample CSV.
    reply.header("content-type", "text/csv");
    return `type,time,coin,side,dir,px,sz,pnl_or_usdc,fee,hash\nfill,2026-09-01T00:00:00.000Z,xyz:TSLA,B,,100,2,0,0.1,demo\n# address ${address} format ${q.format ?? "generic"}\n`;
  });
  return app;
}

if (process.env.VITEST !== "true") {
  buildServer().listen({ port: PORT, host: "0.0.0.0" }).then(() => console.log(`indexer on :${PORT}`));
}
