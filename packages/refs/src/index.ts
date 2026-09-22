import type { SessionState } from "@kerb/sessions";
export type RefSourceId = "hl_crossdex" | "pyth" | "last_close";
export interface RefQuote { source: RefSourceId; coin: string; price: number; ts: number; session: SessionState; confidence?: number }
export interface RefAdapter {
  id: RefSourceId;
  supports(coin: string): boolean;
  subscribe(coins: string[], onQuote: (q: RefQuote) => void): () => void;
  health(): { ok: boolean; lastQuoteAt?: number; error?: string };
}
export const REF_MAX_AGE_MS_DEFAULT = 60_000;
export const LAST_CLOSE_MAX_AGE_MS = 24 * 3600_000;
/** Composite = median of live quotes; last_close only if nothing else live. */
export function compositeRef(quotes: RefQuote[], now: number, refMaxAgeMs = REF_MAX_AGE_MS_DEFAULT): { price: number | null; lastCloseOnly: boolean; used: RefQuote[] } {
  const live = quotes.filter((q) => now - q.ts <= (q.source === "last_close" ? LAST_CLOSE_MAX_AGE_MS : refMaxAgeMs));
  const nonClose = live.filter((q) => q.source !== "last_close");
  const pool = nonClose.length ? nonClose : live;
  if (!pool.length) return { price: null, lastCloseOnly: false, used: [] };
  const prices = pool.map((q) => q.price).sort((a, b) => a - b);
  const mid = prices[Math.floor(prices.length / 2)];
  return { price: mid, lastCloseOnly: nonClose.length === 0, used: pool };
}
/** Last-close store: updated at session close. */
export class LastCloseStore {
  private map = new Map<string, RefQuote>();
  set(coin: string, price: number, session: SessionState = "closed") {
    this.map.set(coin, { source: "last_close", coin, price, ts: Date.now(), session });
  }
  get(coin: string): RefQuote | undefined { return this.map.get(coin); }
  adapter(): RefAdapter {
    const store = this;
    return {
      id: "last_close",
      supports: (c) => store.map.has(c),
      subscribe: (coins, onQuote) => {
        const t = setInterval(() => { for (const c of coins) { const q = store.map.get(c); if (q) onQuote({ ...q }); } }, 5000);
        return () => clearInterval(t as unknown as number);
      },
      health: () => ({ ok: true, lastQuoteAt: Date.now() }),
    };
  }
}
/** hl_crossdex: derive pairs from markets.json (same underlying.symbol). */
export function crossDexPairs(registry: Record<string, { underlying: { symbol: string } }>): [string, string][] {
  const bySymbol = new Map<string, string[]>();
  for (const [coin, m] of Object.entries(registry)) {
    const arr = bySymbol.get(m.underlying.symbol) ?? [];
    arr.push(coin); bySymbol.set(m.underlying.symbol, arr);
  }
  const pairs: [string, string][] = [];
  for (const coins of bySymbol.values()) for (let i = 0; i < coins.length; i++) for (let j = i + 1; j < coins.length; j++) pairs.push([coins[i], coins[j]]);
  return pairs;
}
export async function fetchPythPrice(priceId: string, hermesUrl = "https://hermes.pyth.network"): Promise<{ price: number; conf: number; ts: number } | null> {
  try {
    const r = await fetch(`${hermesUrl}/v2/updates/price/latest?ids[]=${priceId}`);
    if (!r.ok) return null;
    const j = await r.json() as { parsed?: [{ price: { price: string; expo: number; conf: string; publish_time: number } }] };
    const p = j.parsed?.[0]?.price;
    if (!p) return null;
    return { price: Number(p.price) * 10 ** p.expo, conf: Number(p.conf) * 10 ** p.expo, ts: p.publish_time * 1000 };
  } catch { return null; }
}
