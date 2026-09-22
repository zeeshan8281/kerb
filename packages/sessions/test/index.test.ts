import { describe, expect, it } from "vitest";
import { sessionAt, type CalendarDef } from "../src/index.js";
import usCal from "../../../config/calendars/us-equities.json";
import krxCal from "../../../config/calendars/krx-nxt.json";
import tseCal from "../../../config/calendars/tse.json";

const us = usCal as unknown as CalendarDef;
describe("sessions", () => {
  it("US open during regular hours (summer, EDT)", () => {
    // 2026-07-01 10:00 New York = 14:00Z
    const t = Date.parse("2026-07-01T14:00:00Z");
    expect(sessionAt(us, t).state).toBe("open");
  });
  it("US closed on weekend", () => {
    const t = Date.parse("2026-07-04T14:00:00Z"); // Saturday
    expect(sessionAt(us, t).state).toBe("closed");
  });
  it("US holiday flagged", () => {
    const t = Date.parse("2026-12-25T15:00:00Z");
    const s = sessionAt(us, t);
    expect(s.isHoliday).toBe(true);
  });
  it("DST boundary: pre-market in March", () => {
    const t = Date.parse("2026-03-09T11:00:00Z"); // 07:00 EDT -> pre
    expect(sessionAt(us, t).state).toBe("pre");
  });
  it("TSE lunch break", () => {
    const tse = tseCal as unknown as CalendarDef;
    const t = Date.parse("2026-07-01T03:00:00Z"); // 12:00 JST lunch
    expect(sessionAt(tse, t).state).toBe("lunch");
  });
  it("KRX open", () => {
    const krx = krxCal as unknown as CalendarDef;
    const t = Date.parse("2026-07-01T01:00:00Z"); // 10:00 KST
    expect(sessionAt(krx, t).state).toBe("open");
  });
});
