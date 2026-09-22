"use client";
import { useState } from "react";
const API = process.env.NEXT_PUBLIC_INDEXER ?? "http://localhost:8080";
export default function Archive() {
  const [addr, setAddr] = useState("");
  const [status, setStatus] = useState("");
  return (
    <div>
      <h1>Archiver</h1>
      <p style={{ color: "#888" }}>Continuous capture beyond Hyperliquid's 10,000-fill window. CSV export.</p>
      <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x..." style={{ background: "#111", color: "#eee", border: "1px solid #444", padding: 6, width: 380 }} />
      <button onClick={async () => { const r = await fetch(`${API}/v1/archive/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr }) }); setStatus(JSON.stringify(await r.json())); }}>Register</button>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        {(["generic", "koinly", "koinx_draft"] as const).map((f) => (
          <a key={f} href={`${API}/v1/archive/${addr}/export?format=${f}`} style={{ color: "#58a6ff" }}>Export {f}</a>
        ))}
      </div>
      <p>{status}</p>
    </div>
  );
}
