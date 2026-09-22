import { postInfo } from "@kerb/hl";
/** Archiver: paginated backfill beyond the 10k-fill window. */
export async function backfillFills(network: "mainnet" | "testnet", user: string, known: Set<string>, onBatch: (fills: FillRecord[]) => Promise<void>): Promise<void> {
  let end = Date.now();
  const PAGE = 2000;
  for (let iter = 0; iter < 50; iter++) {
    const start = 0;
    const batch = (await postInfo<FillRecord[]>(network, { type: "userFillsByTime", user, startTime: start, endTime: end })).slice(0, PAGE);
    const fresh = batch.filter((f) => !known.has(fillKey(f)));
    if (!fresh.length) break;
    await onBatch(fresh);
    for (const f of fresh) known.add(fillKey(f));
    const oldest = Math.min(...fresh.map((f) => f.time));
    if (batch.length < PAGE) break;
    end = oldest - 1; // paginate using last timestamp as next startTime bound
    if (fresh.length < batch.length * 0.1) break; // mostly known -> caught up
  }
}
export interface FillRecord { tid: number; time: number; coin: string; px: string; sz: string; side: string; dir?: string; closedPnl?: string; fee?: string; hash?: string; oid?: number; crossed?: boolean; builderFee?: string; liquidation?: unknown }
export function fillKey(f: FillRecord): string { return `${f.tid}`; }
export function normalizeFill(address: string, f: FillRecord): Record<string, unknown> {
  return {
    address, tid: f.tid, coin: f.coin, px: Number(f.px), sz: Number(f.sz), side: f.side, dir: f.dir,
    time: f.time, closedPnl: Number(f.closedPnl ?? 0), fee: Number(f.fee ?? 0), hash: f.hash,
    oid: f.oid, crossed: f.crossed, builderFee: Number(f.builderFee ?? 0), raw: f,
  };
}
