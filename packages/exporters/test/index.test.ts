import { describe, expect, it } from "vitest";
import { exportGeneric, exportKoinly } from "../src/index.js";
describe("exporters", () => {
  const fills = [{ time: 1700000000000, coin: "xyz:TSLA", side: "B", px: 100, sz: 2, fee: 0.1, tid: 1 }];
  it("generic has header + row", () => { const c = exportGeneric(fills, []); expect(c.split("\n")[0]).toContain("type,time"); expect(c).toContain("xyz:TSLA"); });
  it("koinly template", () => { const c = exportKoinly(fills, []); expect(c.split("\n")[0]).toContain("Sent Amount"); });
});
