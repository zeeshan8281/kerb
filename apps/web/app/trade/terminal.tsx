"use client";
import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { toViemAccount } from "@privy-io/react-auth";
import { privateKeyToAccount, type Account } from "viem/accounts";
import { evaluateOrder, leverageCapFor } from "@kerb/core";
import {
  BUILDER_ADDRESS, BUILDER_FEE_TENTHS_BP, IS_TESTNET,
  hlApproveBuilderFee, hlApproveAgent, hlPlaceOrder, resolveHip3AssetId, newAgentAccount,
} from "../../lib/hl";
import { storeAgent, loadAgent, clearAgent } from "../../lib/agent";

const API = process.env.NEXT_PUBLIC_INDEXER ?? "http://localhost:8080";

export function TradeTerminal() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [coin, setCoin] = useState("xyz:TSLA");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("1");
  const [price, setPrice] = useState("0");
  const [kind, setKind] = useState<"market" | "limit-gtc" | "limit-alo">("limit-gtc");
  const [phrase, setPhrase] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [builderApproved, setBuilderApproved] = useState<boolean | null>(null);
  const [agent, setAgent] = useState<{ address: `0x${string}`; expiresAt: number } | null>(null);
  const [snap, setSnap] = useState<{ flag: "RED" | "AMBER" | "GREEN"; divergenceBps: number | null; session: string; depthBid: number; depthAsk: number; oracle: number } | null>(null);

  useEffect(() => { fetch(`${API}/v1/markets/${encodeURIComponent(coin)}`).then((r) => r.json()).then(setSnap).catch(() => {}); }, [coin]);

  const address = wallet?.address as `0x${string}` | undefined;

  useEffect(() => {
    if (!address) { setAgent(null); return; }
    loadAgent(address).then((a) => setAgent(a ? { address: a.address, expiresAt: a.expiresAt } : null));
  }, [address]);

  async function getAccount(): Promise<any> {
    if (!wallet) throw new Error("no wallet");
    return toViemAccount({ wallet });
  }

  async function checkBuilderApproval() {
    if (!address) return;
    setBusy(true); setStatus("checking builder fee…");
    try {
      const r = await fetch(`https://api.hyperliquid.xyz/info`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "maxBuilderFee", user: address, builder: BUILDER_ADDRESS }),
      });
      const j = await r.json();
      setBuilderApproved(Number(String(j.maxFeeRate ?? "0").replace("%", "")) >= BUILDER_FEE_TENTHS_BP / 1000);
      setStatus("");
    } catch (e) { setStatus(`error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  async function approveBuilder() {
    setBusy(true); setStatus("approving builder fee (sign in Privy)…");
    try {
      await hlApproveBuilderFee(await getAccount());
      setBuilderApproved(true);
      setStatus("builder fee approved");
    } catch (e) { setStatus(`error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  async function setupAgent() {
    if (!address) return;
    setBusy(true); setStatus("setting up agent key…");
    try {
      const existing = await loadAgent(address);
      let account: Account;
      let pk: `0x${string}`;
      if (existing && existing.expiresAt > Date.now()) {
        account = privateKeyToAccount(existing.privateKey);
        pk = existing.privateKey;
      } else {
        const fresh = newAgentAccount();
        account = fresh.account;
        pk = fresh.privateKey;
      }
      const expiresAt = Date.now() + 30 * 24 * 3600 * 1000;
      await hlApproveAgent(await getAccount(), account.address as `0x${string}`, expiresAt);
      await storeAgent(address, { privateKey: pk, address: account.address as `0x${string}`, expiresAt });
      setAgent({ address: account.address as `0x${string}`, expiresAt });
      setStatus(`agent approved: ${account.address.slice(0, 10)}…`);
    } catch (e) { setStatus(`error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  const budget = side === "buy" ? (snap?.depthAsk ?? 10) : (snap?.depthBid ?? 10);
  const decision = snap ? evaluateOrder(
    { coin, side, size: Number(size) || 0, kind: kind === "market" ? "market" : kind === "limit-alo" ? "limit-alo" : "limit-gtc", leverageAfter: 5 },
    { flag: snap.flag, divBps: snap.divergenceBps ?? 0, session: (snap.session ?? "open") as "open", budget, leverageCap: leverageCapFor((snap.session ?? "open") as "open"), liqDistancePctAfter: 4, worstOffHoursMovePct: 8 }
  ) : null;

  const blocked = decision?.kind === "block" && phrase !== "I ACCEPT DIVERGENCE RISK";

  async function placeOrder() {
    setBusy(true); setStatus("placing order…");
    try {
      let signer: any = await getAccount();
      if (agent && address) {
        const stored = await loadAgent(address);
        if (stored) signer = privateKeyToAccount(stored.privateKey);
      }
      const assetId = await resolveHip3AssetId(coin);
      const px = kind === "market" ? (snap?.oracle ?? 0).toFixed(3) : Number(price).toFixed(3);
      const tif = kind === "market" ? "Ioc" : kind === "limit-alo" ? "Alo" : "Gtc";
      const res = await hlPlaceOrder(signer, { assetId, isBuy: side === "buy", price: px, size, tif });
      setStatus(`order sent: ${JSON.stringify(res).slice(0, 200)}`);
    } catch (e) { setStatus(`error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  if (!ready) return <p>loading…</p>;

  return (
    <div>
      <h1>Terminal (HIP-3 · {IS_TESTNET ? "testnet" : "mainnet"})</h1>
      <p style={{ color: "#888" }}>Guards run in-browser before signing. Information only. Kerb cannot prevent liquidation.</p>

      {!authenticated ? (
        <div style={{ border: "1px solid #333", padding: 20, maxWidth: 400 }}>
          <p>Connect a wallet to trade. Kerb uses an embedded wallet (email/Google) — your keys stay on-device.</p>
          <button onClick={() => login()} style={{ padding: "8px 24px", background: "#238636", color: "#fff", border: 0 }}>Connect with Privy</button>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#9fb3c8" }}>wallet: <b>{address?.slice(0, 12)}…{address?.slice(-4)}</b></span>
            <button onClick={checkBuilderApproval} disabled={busy} style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: "4px 10px" }}>Check builder fee</button>
            {builderApproved === false && <button onClick={approveBuilder} disabled={busy} style={{ background: "#d29922", color: "#000", border: 0, padding: "4px 10px" }}>Approve {BUILDER_FEE_TENTHS_BP / 10} bps builder fee</button>}
            {builderApproved === true && <span style={{ color: "#3fb950" }}>✓ builder fee approved</span>}
            {!agent && <button onClick={setupAgent} disabled={busy} style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: "4px 10px" }}>Set up agent key</button>}
            {agent && <span style={{ color: "#3fb950" }}>✓ agent {agent.address.slice(0, 8)}…</span>}
            <button onClick={() => { if (address) clearAgent(address); logout(); }} style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: "4px 10px" }}>Disconnect</button>
          </div>
        </div>
      )}

      {authenticated && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input value={coin} onChange={(e) => setCoin(e.target.value)} style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: 6 }} />
            <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}><option value="buy">buy</option><option value="sell">sell</option></select>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="market">market</option><option value="limit-gtc">limit</option><option value="limit-alo">alo</option></select>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="size" style={{ width: 80, background: "#111", color: "#eee", border: "1px solid #444", padding: 6 }} />
            {kind !== "market" && <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="price" style={{ width: 90, background: "#111", color: "#eee", border: "1px solid #444", padding: 6 }} />}
          </div>
          {snap && <p>Flag <b>{snap.flag}</b> · oracle {snap.oracle} · div {snap.divergenceBps?.toFixed(1)} bps · session {snap.session} · budget {budget.toFixed(2)}</p>}
          {decision && decision.kind !== "allow" && (
            <div style={{ border: `1px solid ${decision.kind === "block" ? "red" : "orange"}`, padding: 12, marginBottom: 12 }}>
              <b>{decision.kind.toUpperCase()}</b>
              <ul>{decision.reasons.map((r) => <li key={r.code}>{r.message}</li>)}</ul>
              {decision.kind === "block" && <><p>Type <code>I ACCEPT DIVERGENCE RISK</code> to override:</p><input value={phrase} onChange={(e) => setPhrase(e.target.value)} style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: 6, width: 300 }} /></>}
            </div>
          )}
          <button onClick={placeOrder} disabled={busy || blocked || !address} style={{ padding: "8px 24px", background: side === "buy" ? "#238636" : "#da3633", color: "#fff", border: 0, opacity: (busy || blocked) ? 0.5 : 1 }}>
            {busy ? "…" : `Place ${side} ${size} ${coin}`}
          </button>
          <p style={{ color: "#888", fontSize: 12 }}>Builder fee {BUILDER_FEE_TENTHS_BP / 10} bps → {BUILDER_ADDRESS.slice(0, 10)}… · signed by {agent ? "agent key" : "main wallet"}</p>
        </>
      )}
      {status && <p style={{ marginTop: 12, color: "#d29922" }}>{status}</p>}
    </div>
  );
}