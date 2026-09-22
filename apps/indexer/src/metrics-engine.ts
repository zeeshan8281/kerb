import { divergenceBps, markPremiumBps, riskFlag, depthBudgetFromBook, stalenessStats } from "@kerb/core";
import { compositeRef, LastCloseStore, type RefQuote } from "@kerb/refs";
import { sessionAt, type CalendarDef } from "@kerb/sessions";

export interface CoinState {
  coin: string; oraclePx: number; markPx: number; midPx: number; funding?: number;
  oracleUpdatedAt: number; intervals: number[];
  refQuotes: RefQuote[]; bids: { px: number; sz: number }[]; asks: { px: number; sz: number }[];
  calendar?: CalendarDef; worstOffHoursMovePct: number; lastOracle: number;
}
export interface MetricSnapshot {
  coin: string; ts: number; oracle: number; mark: number; composite: number | null;
  divergenceBps: number | null; markPremiumBps: number | null; stalenessMs: number;
  staleP50: number; staleP95: number; depthBid: number; depthAsk: number;
  flag: "RED" | "AMBER" | "GREEN"; session: string; lastCloseOnly: boolean;
}
export function computeSnapshot(s: CoinState, now: number, thresholds = { divAmberBps: 50, divRedBps: 150, staleRedMs: 120000 }): MetricSnapshot {
  const comp = compositeRef(s.refQuotes, now);
  const div = comp.price != null ? divergenceBps(s.oraclePx, comp.price) : null;
  const prem = markPremiumBps(s.markPx, s.oraclePx);
  const staleness = now - s.oracleUpdatedAt;
  const stats = stalenessStats(s.intervals.slice(-900));
  const session = s.calendar ? sessionAt(s.calendar, now).state : "closed";
  const depthBid = depthBudgetFromBook("bid", s.bids, s.asks, 50).size;
  const depthAsk = depthBudgetFromBook("ask", s.bids, s.asks, 50).size;
  const flag = riskFlag({ divBps: Math.abs(div ?? 0), stalenessMs: staleness, session, thresholds });
  return { coin: s.coin, ts: now, oracle: s.oraclePx, mark: s.markPx, composite: comp.price, divergenceBps: div, markPremiumBps: prem, stalenessMs: staleness, staleP50: stats.p50, staleP95: stats.p95, depthBid, depthAsk, flag, session, lastCloseOnly: comp.lastCloseOnly };
}
export function trackWorstMove(history: { ts: number; oracle: number; session: string }[], floorPct: number): number {
  let worst = floorPct;
  const off = history.filter((h) => h.session !== "open").map((h) => h.oracle);
  for (let i = 1; i < off.length; i++) {
    if (off[i - 1]) { const m = Math.abs(off[i] - off[i - 1]) / off[i - 1] * 100; if (m > worst) worst = m; }
  }
  return worst;
}
export { LastCloseStore };
