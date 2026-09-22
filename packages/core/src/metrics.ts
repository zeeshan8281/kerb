import type { SessionState } from "@kerb/sessions";

export type Flag = "RED" | "AMBER" | "GREEN";
export interface Thresholds { divAmberBps: number; divRedBps: number; staleRedMs: number; transitionWarnMs?: number }

export function divergenceBps(oraclePx: number, compositeRef: number): number {
  if (!compositeRef) return 0;
  return ((oraclePx - compositeRef) / compositeRef) * 1e4;
}
export function markPremiumBps(markPx: number, oraclePx: number): number {
  if (!oraclePx) return 0;
  return ((markPx - oraclePx) / oraclePx) * 1e4;
}
export function crossDexSpreadBps(oracles: number[]): number {
  if (oracles.length < 2) return 0;
  const mx = Math.max(...oracles), mn = Math.min(...oracles);
  if (!mn) return 0;
  return ((mx - mn) / mn) * 1e4;
}
export interface Level { px: number; sz: number }
export interface DepthResult { size: number; notional: number; levelsUsed: number; bookExhausted: boolean; avgPx: number }
export function depthBudget(side: "bid" | "ask", levels: Level[], maxSlipBps: number): DepthResult {
  const sorted = [...levels].sort((a, b) => (side === "bid" ? b.px - a.px : a.px - b.px));
  if (sorted.length === 0 || maxSlipBps < 0) return { size: 0, notional: 0, levelsUsed: 0, bookExhausted: true, avgPx: 0 };
  const mid = midFromLevels(sorted);
  const limit = side === "bid" ? mid * (1 - maxSlipBps / 1e4) : mid * (1 + maxSlipBps / 1e4);
  let cumSz = 0, cumNot = 0, used = 0;
  for (const l of sorted) {
    const ns = cumSz + l.sz, nn = cumNot + l.sz * l.px;
    const avg = nn / ns;
    const ok = side === "bid" ? avg >= limit : avg <= limit;
    if (!ok) break;
    cumSz = ns; cumNot = nn; used++;
  }
  return { size: cumSz, notional: cumNot, levelsUsed: used, bookExhausted: used === sorted.length && used > 0, avgPx: cumSz ? cumNot / cumSz : 0 };
}
function midFromLevels(levels: Level[]): number {
  return levels.length ? levels[0].px : 0;
}
/** Depth budget from a two-sided book walking from mid. */
export function depthBudgetFromBook(side: "bid" | "ask", bids: Level[], asks: Level[], maxSlipBps: number): DepthResult {
  const mid = bids.length && asks.length ? (bids[0].px + asks[0].px) / 2 : (bids[0]?.px ?? asks[0]?.px ?? 0);
  const levels = side === "bid" ? bids : asks;
  const sorted = [...levels].sort((a, b) => (side === "bid" ? b.px - a.px : a.px - b.px));
  let cumSz = 0, cumNot = 0, used = 0;
  for (const l of sorted) {
    const ns = cumSz + l.sz, nn = cumNot + l.sz * l.px;
    const avg = nn / ns;
    const slip = Math.abs(avg - mid) / mid * 1e4;
    if (slip > maxSlipBps) break;
    cumSz = ns; cumNot = nn; used++;
  }
  return { size: cumSz, notional: cumNot, levelsUsed: used, bookExhausted: used === sorted.length && used > 0, avgPx: cumSz ? cumNot / cumSz : 0 };
}
export function liqDistancePct(liqPx: number | null | undefined, markPx: number): number | null {
  if (liqPx == null || !markPx) return null;
  return (Math.abs(liqPx - markPx) / markPx) * 100;
}
export interface FlagInput {
  divBps: number; stalenessMs: number; session: SessionState;
  msToTransition?: number; thresholds: Thresholds;
}
export function riskFlag(i: FlagInput): Flag {
  const t = i.thresholds;
  if (Math.abs(i.divBps) >= t.divRedBps) return "RED";
  if (i.stalenessMs > t.staleRedMs && i.session !== "open") return "RED";
  if ((i.msToTransition ?? Infinity) <= (t.transitionWarnMs ?? 5 * 60_000) && Math.abs(i.divBps) >= t.divAmberBps) return "RED";
  if (Math.abs(i.divBps) >= t.divAmberBps) return "AMBER";
  if (["closed", "overnight", "pre", "post"].includes(i.session)) return "AMBER";
  return "GREEN";
}
export function rollingQuantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}
export function stalenessStats(intervalsMs: number[]): { p50: number; p95: number } {
  const s = [...intervalsMs].sort((a, b) => a - b);
  return { p50: rollingQuantile(s, 0.5), p95: rollingQuantile(s, 0.95) };
}
