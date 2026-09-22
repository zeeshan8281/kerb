import { describe, expect, it } from "vitest";
import { compositeRef, crossDexPairs } from "../src/index.js";
describe("refs", () => {
  it("median composite", () => {
    const now = Date.now();
    const q = [100, 102, 104].map((p) => ({ source: "pyth" as const, coin: "x:Y", price: p, ts: now, session: "open" as const }));
    expect(compositeRef(q, now).price).toBe(102);
  });
  it("last close only flag", () => {
    const now = Date.now();
    const q = [{ source: "last_close" as const, coin: "x:Y", price: 50, ts: now, session: "closed" as const }];
    const r = compositeRef(q, now);
    expect(r.lastCloseOnly).toBe(true); expect(r.price).toBe(50);
  });
  it("stale quotes discarded", () => {
    const now = Date.now();
    const q = [{ source: "pyth" as const, coin: "x:Y", price: 50, ts: now - 600_000, session: "open" as const }];
    expect(compositeRef(q, now).price).toBeNull();
  });
  it("crossdex pairs", () => {
    const reg = { "a:TSLA": { underlying: { symbol: "TSLA" } }, "b:TSLA": { underlying: { symbol: "TSLA" } }, "a:NVDA": { underlying: { symbol: "NVDA" } } };
    expect(crossDexPairs(reg)).toEqual([["a:TSLA", "b:TSLA"]]);
  });
});
