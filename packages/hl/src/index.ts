// Thin typed wrapper over Hyperliquid raw REST/WS + HIP-3 helpers.
export const MAINNET_API = "https://api.hyperliquid.xyz";
export const TESTNET_API = "https://api.hyperliquid-testnet.xyz";
export const MAINNET_WS = "wss://api.hyperliquid.xyz/ws";
export const TESTNET_WS = "wss://api.hyperliquid-testnet.xyz/ws";

export function apiBase(network: "mainnet" | "testnet"): string {
  return network === "mainnet" ? MAINNET_API : TESTNET_API;
}
export function wsUrl(network: "mainnet" | "testnet"): string {
  return network === "mainnet" ? MAINNET_WS : TESTNET_WS;
}

/** HIP-3 asset id: 100000 + perp_dex_index * 10000 + index_in_meta */
export function assetIdFor(perpDexIndex: number, indexInMeta: number): number {
  return 100000 + perpDexIndex * 10000 + indexInMeta;
}

/** Parse "dex:coin" HIP-3 coin name. */
export function parseHip3Coin(coin: string): { dex: string; base: string } {
  const i = coin.indexOf(":");
  if (i < 0) throw new Error(`not a HIP-3 coin: ${coin}`);
  return { dex: coin.slice(0, i), base: coin.slice(i + 1) };
}

export function isHip3Coin(coin: string): boolean {
  return coin.includes(":");
}

export interface AssetCtx {
  oraclePx: string; markPx?: string; midPx?: string; funding?: string;
  openInterest?: string; premium?: string; dayNtlVlm?: string; prevDayPx?: string;
  impactPxs?: [string, string];
}

export async function postInfo<T>(network: "mainnet" | "testnet", body: unknown): Promise<T> {
  const r = await fetch(`${apiBase(network)}/info`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`info ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export async function getPerpDexs(network: "mainnet" | "testnet"): Promise<string[]> {
  const dexs = await postInfo<Array<{ name: string } | string>>(network, { type: "perpDexs" });
  return (dexs as Array<{ name: string }>).map((d) => (typeof d === "string" ? d : d.name));
}

export interface PerpMeta { name: string; szDecimals: number; maxLeverage?: number; onlyIsolated?: boolean }
export async function getAllPerpMetas(network: "mainnet" | "testnet"): Promise<{ dex: string; index: number; meta: { universe: PerpMeta[] } }[]> {
  const raw = await postInfo<Array<[string, { universe: PerpMeta[] }]>>(network, { type: "allPerpMetas" });
  return raw.map(([dex, meta], index) => ({ dex, index, meta }));
}

/** Resolve dex index + position-in-meta for a HIP-3 coin, then asset id. */
export async function resolveAssetId(network: "mainnet" | "testnet", coin: string): Promise<{ dexIndex: number; indexInMeta: number; assetId: number }> {
  const { dex, base } = parseHip3Coin(coin);
  const metas = await getAllPerpMetas(network);
  const entry = metas.find((m) => m.dex === dex);
  if (!entry) throw new Error(`dex not found: ${dex}`);
  const idx = entry.meta.universe.findIndex((u) => u.name === base);
  if (idx < 0) throw new Error(`coin ${base} not in dex ${dex}`);
  return { dexIndex: entry.index, indexInMeta: idx, assetId: assetIdFor(entry.index, idx) };
}

export async function getMaxBuilderFee(network: "mainnet" | "testnet", user: string, builder: string): Promise<number> {
  const r = await postInfo<{ maxFeeRate: string }>(network, { type: "maxBuilderFee", user, builder });
  const s = String(r.maxFeeRate ?? "0%").replace("%", "");
  return Number.parseFloat(s) / 100;
}

export async function getUserFillsByTime(network: "mainnet" | "testnet", user: string, startTime: number, endTime: number): Promise<unknown[]> {
  return postInfo<unknown[]>(network, { type: "userFillsByTime", user, startTime, endTime });
}

export async function getMetaAndAssetCtxs(network: "mainnet" | "testnet", dex = ""): Promise<unknown> {
  return postInfo(network, { type: "metaAndAssetCtxs", dex });
}
