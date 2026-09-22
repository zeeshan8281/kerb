export type SessionState = "closed" | "pre" | "open" | "lunch" | "post" | "overnight";
export interface SessionInfo {
  state: SessionState; venue: string;
  nextTransition: { state: SessionState; at: number }; isHoliday: boolean;
}
export interface Segment { state: SessionState; start: string; end: string }
export interface CalendarDef {
  id: string; venue: string; tz: string;
  days: Record<string, Segment[]>; // "mon"|"tue"|...|"sat"|"sun"|"weekday"
  holidays: string[]; // YYYY-MM-DD
}
export function loadCalendar(def: CalendarDef): CalendarDef { return def; }
function ymdInTz(epochMs: number, tz: string): { ymd: string; dow: string; mins: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(epochMs));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const ymd = `${g("year")}-${g("month")}-${g("day")}`;
  const dow = g("weekday").toLowerCase();
  const mins = Number.parseInt(g("hour"), 10) * 60 + Number.parseInt(g("minute"), 10);
  return { ymd, dow, mins };
}
function toMins(hhmm: string): number { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
/** Pure function: session state at epochMs. DST-correct via Intl tz conversion. */
export function sessionAt(cal: CalendarDef, epochMs: number): SessionInfo {
  const { ymd, dow, mins } = ymdInTz(epochMs, cal.tz);
  const isHoliday = cal.holidays.includes(ymd);
  const key = isHoliday ? "holiday" : (cal.days[dow] ? dow : (dow === "sat" || dow === "sun" ? dow : "weekday"));
  const segs: Segment[] = cal.days[key] ?? [];
  for (const s of segs) {
    if (mins >= toMins(s.start) && mins < toMins(s.end)) {
      return { state: s.state, venue: cal.venue, nextTransition: { state: nextState(segs, s), at: endMs(cal, epochMs, s.end) }, isHoliday };
    }
  }
  // closed: next transition is first segment tomorrow (approx)
  return { state: "closed", venue: cal.venue, nextTransition: { state: segs[0]?.state ?? "closed", at: epochMs + 60_000 }, isHoliday };
}
function nextState(segs: Segment[], cur: Segment): SessionState {
  const i = segs.indexOf(cur);
  return segs[i + 1]?.state ?? "closed";
}
function endMs(cal: CalendarDef, epochMs: number, endHHmm: string): number {
  // Approximate: compute minutes-until-end in tz wall time.
  const { mins } = ymdInTz(epochMs, cal.tz);
  const diff = Math.max(1, toMins(endHHmm) - mins);
  return epochMs + diff * 60_000;
}
