// Hyperliquid trading helpers. All signing happens in the browser via the caller's wallet.
// Uses @nktkas/hyperliquid (first-class Privy support) for EIP-712 + canonicalization.
import { HttpTransport } from "@nktkas/hyperliquid";
import { approveAgent, approveBuilderFee, order } from "@nktkas/hyperliquid/api/exchange";
import type { AbstractWallet } from "@nktkas/hyperliquid/signing";
import { generatePrivateKey, privateKeyToAccount, type Account } from "viem/accounts";

export const BUILDER_ADDRESS = (process.env.NEXT_PUBLIC_BUILDER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const BUILDER_FEE_TENTHS_BP = Number(process.env.NEXT_PUBLIC_BUILDER_FEE_TENTHS_BP ?? 45); // 45 = 4.5 bps
export const IS_TESTNET = process.env.NEXT_PUBLIC_HL_NETWORK === "testnet";

const transport = () => new HttpTransport({ isTestnet: IS_TESTNET });

function builderFeeString(tenthsBp: number): `${string}%` {
  return `${(tenthsBp / 1000).toFixed(3)}%`; // 45 -> "0.045%"
}

export async function hlApproveBuilderFee(wallet: AbstractWallet) {
  return approveBuilderFee({ transport: transport(), wallet }, {
    maxFeeRate: builderFeeString(BUILDER_FEE_TENTHS_BP),
    builder: BUILDER_ADDRESS,
  });
}

export async function hlApproveAgent(wallet: AbstractWallet, agentAddress: `0x${string}`, expiresAt: number) {
  return approveAgent({ transport: transport(), wallet }, {
    agentAddress,
    agentName: `kerb valid_until ${expiresAt}`,
  });
}

export interface NewOrder {
  assetId: number;   // HIP-3 asset id (100000 + dexIndex*10000 + index)
  isBuy: boolean;
  price: string;
  size: string;
  reduceOnly?: boolean;
  tif?: "Gtc" | "Ioc" | "Alo";
}

export async function hlPlaceOrder(wallet: AbstractWallet, o: NewOrder) {
  return order({ transport: transport(), wallet }, {
    orders: [{
      a: o.assetId,
      b: o.isBuy,
      p: o.price,
      s: o.size,
      r: o.reduceOnly ?? false,
      t: { limit: { tif: o.tif ?? "Gtc" } },
    }],
    grouping: "na",
    builder: { b: BUILDER_ADDRESS, f: BUILDER_FEE_TENTHS_BP },
  });
}

/** Resolve HIP-3 asset id for a coin (e.g. "xyz:TSLA") from allPerpMetas. Cached. */
const assetIdCache = new Map<string, number>();
export async function resolveHip3AssetId(coin: string): Promise<number> {
  if (assetIdCache.has(coin)) return assetIdCache.get(coin)!;
  const [dex, base] = coin.split(":");
  const r = await fetch(`https://api.hyperliquid.xyz/info`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "allPerpMetas" }),
  });
  const metas = (await r.json()) as Array<[string, { universe: { name: string }[] }]>;
  for (let dexIndex = 0; dexIndex < metas.length; dexIndex++) {
    const [d, meta] = metas[dexIndex];
    if (d !== dex) continue;
    const idx = meta.universe.findIndex((u) => u.name === base);
    if (idx < 0) throw new Error(`coin ${base} not found in dex ${dex}`);
    const id = 100000 + dexIndex * 10000 + idx;
    assetIdCache.set(coin, id);
    return id;
  }
  throw new Error(`dex ${dex} not found`);
}

/** Generate a fresh agent keypair (stored browser-side; key never leaves device). */
export function newAgentAccount(): { account: Account; privateKey: `0x${string}` } {
  const pk = generatePrivateKey();
  return { account: privateKeyToAccount(pk), privateKey: pk };
}

export { transport };
