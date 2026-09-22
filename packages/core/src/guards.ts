import type { SessionState } from "@kerb/sessions";
import { riskFlag, type Flag, type Thresholds } from "./metrics.js";

export type GuardReason = { code: string; message: string };
export type GuardDecision =
  | { kind: "allow" }
  | { kind: "warn"; reasons: GuardReason[] }
  | { kind: "block"; reasons: GuardReason[]; overridePhrase: string };

export interface OrderIntent {
  coin: string; side: "buy" | "sell"; size: number;
  kind: "market" | "ioc" | "limit-gtc" | "limit-alo";
  leverageAfter?: number; reduceOnly?: boolean;
}
export interface GuardCtx {
  flag: Flag; divBps: number; session: SessionState;
  budget: number; leverageCap: number; liqDistancePctAfter: number | null;
  worstOffHoursMovePct: number; thresholds?: Thresholds;
}
export const OVERRIDE_PHRASE = "I ACCEPT DIVERGENCE RISK";

export function evaluateOrder(order: OrderIntent, ctx: GuardCtx): GuardDecision {
  if (order.reduceOnly) return { kind: "allow" }; // never block risk-reducing
  const warns: GuardReason[] = [];
  const blocks: GuardReason[] = [];
  const isMarketLike = order.kind === "market" || order.kind === "ioc";
  if (ctx.flag === "RED") {
    const r = { code: "DIVERGENCE_RED", message: `Market is RED (div ${ctx.divBps.toFixed(1)} bps)` };
    if (isMarketLike) blocks.push(r); else warns.push(r);
  } else if (ctx.flag === "AMBER") {
    warns.push({ code: "DIVERGENCE_AMBER", message: `Market is AMBER (div ${ctx.divBps.toFixed(1)} bps)` });
  }
  if (order.size > ctx.budget) {
    if (order.size > 2 * ctx.budget) blocks.push({ code: "SIZE_2X", message: `Size ${order.size} exceeds 2x depth budget ${ctx.budget}` });
    else warns.push({ code: "SIZE_BUDGET", message: `Size ${order.size} exceeds depth budget ${ctx.budget}` });
  }
  if ((order.leverageAfter ?? 0) > ctx.leverageCap) {
    blocks.push({ code: "LEVERAGE_CAP", message: `Leverage ${order.leverageAfter}x exceeds ${ctx.session} cap ${ctx.leverageCap}x` });
  }
  if (ctx.liqDistancePctAfter != null && ctx.session !== "open" && ctx.liqDistancePctAfter < ctx.worstOffHoursMovePct) {
    warns.push({ code: "LIQ_VS_WORST", message: `Liq distance ${ctx.liqDistancePctAfter.toFixed(2)}% < worst off-hours move ${ctx.worstOffHoursMovePct.toFixed(2)}%. Information only. Kerb cannot prevent liquidation.` });
  }
  if (blocks.length) return { kind: "block", reasons: blocks, overridePhrase: OVERRIDE_PHRASE };
  if (warns.length) return { kind: "warn", reasons: warns };
  return { kind: "allow" };
}

export function leverageCapFor(session: SessionState, cfg = { open: 10, pre: 5, post: 5, closed: 3, overnight: 3, lunch: 5, weekend: 3 }): number {
  return cfg[session as keyof typeof cfg] ?? 3;
}
export { riskFlag };
