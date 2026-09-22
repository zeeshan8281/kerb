import { describe, expect, it } from "vitest";
import { crossDexSpreadBps, depthBudgetFromBook, divergenceBps, liqDistancePct, markPremiumBps, riskFlag, stalenessStats } from "../src/metrics.js";
import { evaluateOrder } from "../src/guards.js";

describe("metrics", () => {
  it("divergence bps", () => { expect(divergenceBps(101, 100)).toBeCloseTo(100, 6); });
  it("mark premium", () => { expect(markPremiumBps(101, 100)).toBeCloseTo(100, 6); });
  it("cross-dex spread", () => { expect(crossDexSpreadBps([100, 101])).toBeCloseTo(100, 4); expect(crossDexSpreadBps([100])).toBe(0); });
  it("depth monotonicity: bigger allowance never smaller size", () => {
    const asks = [{ px: 100, sz: 1 }, { px: 101, sz: 2 }, { px: 103, sz: 5 }];
    const bids = [{ px: 99, sz: 1 }];
    const a = depthBudgetFromBook("ask", bids, asks, 10);
    const b = depthBudgetFromBook("ask", bids, asks, 200);
    expect(b.size).toBeGreaterThanOrEqual(a.size);
  });
  it("liq distance", () => { expect(liqDistancePct(90, 100)).toBeCloseTo(10, 6); expect(liqDistancePct(null, 100)).toBeNull(); });
  it("flags", () => {
    const t = { divAmberBps: 50, divRedBps: 150, staleRedMs: 120000 };
    expect(riskFlag({ divBps: 200, stalenessMs: 0, session: "open", thresholds: t })).toBe("RED");
    expect(riskFlag({ divBps: 60, stalenessMs: 0, session: "open", thresholds: t })).toBe("AMBER");
    expect(riskFlag({ divBps: 5, stalenessMs: 0, session: "closed", thresholds: t })).toBe("AMBER");
    expect(riskFlag({ divBps: 5, stalenessMs: 0, session: "open", thresholds: t })).toBe("GREEN");
    expect(riskFlag({ divBps: 5, stalenessMs: 200000, session: "closed", thresholds: t })).toBe("RED");
  });
  it("staleness stats", () => {
    const s = stalenessStats([100, 200, 300, 400]);
    expect(s.p50).toBe(300); expect(s.p95).toBe(400);
  });
});
describe("guards", () => {
  const base = { divBps: 0, session: "open" as const, budget: 10, leverageCap: 10, liqDistancePctAfter: 20, worstOffHoursMovePct: 19, flag: "GREEN" as const };
  it("reduce-only always allowed", () => {
    const d = evaluateOrder({ coin: "x:Y", side: "buy", size: 9999, kind: "market", leverageAfter: 99, reduceOnly: true }, { ...base, flag: "RED", divBps: 999 });
    expect(d.kind).toBe("allow");
  });
  it("RED blocks market, warns limit", () => {
    const b = evaluateOrder({ coin: "x:Y", side: "buy", size: 1, kind: "market" }, { ...base, flag: "RED", divBps: 200 });
    expect(b.kind).toBe("block");
    const w = evaluateOrder({ coin: "x:Y", side: "buy", size: 1, kind: "limit-gtc" }, { ...base, flag: "RED", divBps: 200 });
    expect(w.kind).toBe("warn");
  });
  it("size >2x blocks", () => {
    const d = evaluateOrder({ coin: "x:Y", side: "buy", size: 25, kind: "limit-gtc" }, base);
    expect(d.kind).toBe("block");
  });
  it("leverage cap blocks", () => {
    const d = evaluateOrder({ coin: "x:Y", side: "buy", size: 1, kind: "limit-gtc", leverageAfter: 11 }, base);
    expect(d.kind).toBe("block");
  });
});
