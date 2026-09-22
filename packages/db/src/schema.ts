import { pgTable, text, doublePrecision, bigint, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";
export const markets = pgTable("markets", {
  coin: text("coin").primaryKey(), dex: text("dex").notNull(),
  underlyingVenue: text("underlying_venue"), underlyingSymbol: text("underlying_symbol"),
  assetClass: text("asset_class"), calendarId: text("calendar_id"),
  mapped: boolean("mapped").default(true), updatedAt: bigint("updated_at", { mode: "number" }),
});
export const assetCtxSnapshots = pgTable("asset_ctx_snapshots", {
  coin: text("coin").notNull(), ts: bigint("ts", { mode: "number" }).notNull(),
  oraclePx: doublePrecision("oracle_px"), markPx: doublePrecision("mark_px"), midPx: doublePrecision("mid_px"),
  funding: doublePrecision("funding"), openInterest: doublePrecision("open_interest"),
  premium: doublePrecision("premium"), impactBid: doublePrecision("impact_bid"), impactAsk: doublePrecision("impact_ask"),
}, (t) => [primaryKey({ columns: [t.coin, t.ts] })]);
export const refQuotes = pgTable("ref_quotes", {
  coin: text("coin").notNull(), source: text("source").notNull(), ts: bigint("ts", { mode: "number" }).notNull(),
  price: doublePrecision("price").notNull(), session: text("session"), confidence: doublePrecision("confidence"),
}, (t) => [primaryKey({ columns: [t.coin, t.source, t.ts] })]);
export const metricSnapshots = pgTable("metric_snapshots", {
  coin: text("coin").notNull(), ts: bigint("ts", { mode: "number" }).notNull(),
  divergenceBps: doublePrecision("divergence_bps"), markPremiumBps: doublePrecision("mark_premium_bps"),
  crossDexSpreadBps: doublePrecision("cross_dex_spread_bps"), stalenessMs: doublePrecision("staleness_ms"),
  staleP50Ms: doublePrecision("stale_p50_ms"), staleP95Ms: doublePrecision("stale_p95_ms"),
  depthBid1pct: doublePrecision("depth_bid_1pct"), depthAsk1pct: doublePrecision("depth_ask_1pct"),
  flag: text("flag"), sessionState: text("session_state"),
}, (t) => [primaryKey({ columns: [t.coin, t.ts] })]);
export const archiveAccounts = pgTable("archive_accounts", {
  address: text("address").primaryKey(), registeredAt: bigint("registered_at", { mode: "number" }),
  lastFillTs: bigint("last_fill_ts", { mode: "number" }), lastFundingTs: bigint("last_funding_ts", { mode: "number" }),
  lastLedgerTs: bigint("last_ledger_ts", { mode: "number" }), status: text("status"),
});
export const fills = pgTable("fills", {
  address: text("address").notNull(), tid: bigint("tid", { mode: "number" }).notNull(),
  coin: text("coin"), px: doublePrecision("px"), sz: doublePrecision("sz"), side: text("side"), dir: text("dir"),
  time: bigint("time", { mode: "number" }), closedPnl: doublePrecision("closed_pnl"), fee: doublePrecision("fee"),
  feeToken: text("fee_token"), builderFee: doublePrecision("builder_fee"), crossed: boolean("crossed"),
  hash: text("hash"), oid: bigint("oid", { mode: "number" }), liquidation: jsonb("liquidation"), raw: jsonb("raw"),
}, (t) => [primaryKey({ columns: [t.address, t.tid] })]);
export const fundings = pgTable("fundings", {
  address: text("address").notNull(), time: bigint("time", { mode: "number" }).notNull(), coin: text("coin").notNull(),
  usdc: doublePrecision("usdc"), szi: doublePrecision("szi"), fundingRate: doublePrecision("funding_rate"), raw: jsonb("raw"),
}, (t) => [primaryKey({ columns: [t.address, t.time, t.coin] })]);
export const ledgerUpdates = pgTable("ledger_updates", {
  address: text("address").notNull(), time: bigint("time", { mode: "number" }).notNull(),
  hash: text("hash").notNull(), kind: text("kind"), delta: jsonb("delta"),
}, (t) => [primaryKey({ columns: [t.address, t.hash, t.time] })]);
export const alertSubscriptions = pgTable("alert_subscriptions", {
  id: text("id").primaryKey(), telegramChatId: text("telegram_chat_id"), kind: text("kind"),
  coin: text("coin"), address: text("address"), params: jsonb("params"),
});
export const incidentDrafts = pgTable("incident_drafts", {
  id: text("id").primaryKey(), coin: text("coin"), startedAt: bigint("started_at", { mode: "number" }),
  peakDivergenceBps: doublePrecision("peak_divergence_bps"), text: text("text"), posted: boolean("posted").default(false),
});
