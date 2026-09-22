"use client";
import { useEffect, useState } from "react";
import { evaluateOrder, leverageCapFor } from "@kerb/core";
const API = process.env.NEXT_PUBLIC_INDEXER ?? "http://localhost:8080";
export default function Trade() {
  const [coin, setCoin] = useState("xyz:TSLA");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("1");
  const [kind, setKind] = useState<"market" | "ioc" | "limit-gtc" | "limit-alo">("limit-gtc");
  const [snap, setSnap] = useState<{ flag: "RED" | "AMBER" | "GREEN"; divergenceBps: number | null; session: string; depthBid: number; depthAsk: number } | null>(null);
  const [phrase, setPhrase] = useState("");
  useEffect(() => { fetch(`${API}/v1/markets/${encodeURIComponent(coin)}`).then((r) => r.json()).then(setSnap).catch(() => {}); }, [coin]);
  const budget = side === "buy" ? (snap?.depthAsk ?? 10) : (snap?.depthBid ?? 10);
  const decision = snap ? evaluateOrder(
    { coin, side, size: Number(size) || 0, kind, leverageAfter: 5 },
    { flag: snap.flag, divBps: snap.divergenceBps ?? 0, session: (snap.session ?? "open") as "open", budget, leverageCap: leverageCapFor((snap.session ?? "open") as "open"), liqDistancePctAfter: 4, worstOffHoursMovePct: 8 }
  ) : null;
  return (
    <div>
      <h1>Terminal (HIP-3 only)</h1>
      <p style={{ color: "#888" }}>Guards run in the browser before signing. Information only. Kerb cannot prevent liquidation.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={coin} onChange={(e) => setCoin(e.target.value)} style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: 6 }} />
        <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}><option value="buy">buy</option><option value="sell">sell</option></select>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="market">market</option><option value="ioc">ioc</option><option value="limit-gtc">limit-gtc</option><option value="limit-alo">limit-alo</option></select>
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="size" style={{ width: 80, background: "#111", color: "#eee", border: "1px solid #444", padding: 6 }} />
      </div>
      {snap && <p>Flag <b>{snap.flag}</b> · div {snap.divergenceBps?.toFixed(1)} bps · session {snap.session} · budget {budget.toFixed(2)}</p>}
      {decision && decision.kind !== "allow" && (
        <div style={{ border: `1px solid ${decision.kind === "block" ? "red" : "orange"}`, padding: 12, marginBottom: 12 }}>
          <b>{decision.kind.toUpperCase()}</b>
          <ul>{decision.reasons.map((r) => <li key={r.code}>{r.message}</li>)}</ul>
          {decision.kind === "block" && <><p>Type <code>{decision.overridePhrase}</code> to override:</p><input value={phrase} onChange={(e) => setPhrase(e.target.value)} style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: 6, width: 300 }} /></>}
        </div>
      )}
      <button disabled={decision?.kind === "block" && phrase !== "I ACCEPT DIVERGENCE RISK"} style={{ padding: "8px 24px", background: side === "buy" ? "#238636" : "#da3633", color: "#fff", border: 0 }}>
        {decision?.kind === "block" ? "Blocked — override to place" : `Place ${side} ${size} ${coin}`}
      </button>
      <p style={{ color: "#888", fontSize: 12 }}>Builder fee 4.5 bps (f=45) · agent key stays in browser IndexedDB · approveBuilderFee signed by main wallet.</p>
    </div>
  );
}
