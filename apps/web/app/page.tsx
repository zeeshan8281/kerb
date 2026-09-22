"use client";
import { useEffect, useState } from "react";
const API = process.env.NEXT_PUBLIC_INDEXER ?? "http://localhost:8080";
interface Row { coin: string; session: string; flag: string; oracle: number; composite: number | null; divergenceBps: number | null; stalenessMs: number; depthBid: number; depthAsk: number; lastCloseOnly: boolean; underlying?: { venue: string; symbol: string; name: string }; assetClass?: string; mapped?: boolean }
export default function Board() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    fetch(`${API}/v1/markets`).then((r) => r.json()).then(setRows).catch(() => setRows([]));
    const es = new EventSource(`${API}/v1/stream`);
    es.onmessage = (e) => {
      try {
        const snaps = JSON.parse(e.data) as { coin: string; session: string; flag: string; oracle: number; composite: number; divergenceBps: number; stalenessMs: number; depthBid: number; depthAsk: number; lastCloseOnly: boolean }[];
        setRows((prev) => prev.length ? prev.map((r) => { const s = snaps.find((x) => x.coin === r.coin); return s ? { ...r, ...s } : r; }) : snaps);
      } catch { /* keep */ }
    };
    return () => es.close();
  }, []);
  const order = { RED: 0, AMBER: 1, GREEN: 2 } as Record<string, number>;
  const shown = rows.filter((r) => !filter || r.flag === filter || r.assetClass === filter).sort((a, b) => (order[a.flag] ?? 9) - (order[b.flag] ?? 9) || Math.abs(b.divergenceBps ?? 0) - Math.abs(a.divergenceBps ?? 0));
  const color = (f: string) => (f === "RED" ? "#ff5f56" : f === "AMBER" ? "#e3b008" : "#3fb950");
  return (
    <div>
      <h1>Divergence Board</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["", "RED", "AMBER", "GREEN", "equity", "index", "commodity"].map((f) => (
          <button key={f || "all"} onClick={() => setFilter(f)} style={{ background: filter === f ? "#333" : "#111", color: "#eee", border: "1px solid #444", padding: "4px 10px" }}>{f || "all"}</button>
        ))}
      </div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", color: "#888" }}><th>Market</th><th>Underlying</th><th>Session</th><th>Oracle</th><th>Ref</th><th>Div (bps)</th><th>Stale</th><th>Depth@50bps</th><th>Flag</th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.coin} style={{ borderTop: "1px solid #1c2128" }}>
              <td><a href={`/m/${encodeURIComponent(r.coin)}`} style={{ color: "#58a6ff" }}>{r.coin}</a>{r.mapped === false && <span title="unmapped"> ⚪</span>}</td>
              <td title={r.underlying?.name}>{r.underlying ? `${r.underlying.symbol} · ${r.underlying.venue}` : "—"}</td>
              <td>{r.session}{r.lastCloseOnly && <span title="reference: last close only"> 📌</span>}</td>
              <td title={new Date().toISOString()}>{r.oracle?.toFixed(2)}</td>
              <td>{r.composite?.toFixed(2) ?? "—"}</td>
              <td style={{ color: color(r.flag) }}>{r.divergenceBps?.toFixed(1) ?? "—"}</td>
              <td title="time since oraclePx last changed">{(r.stalenessMs / 1000).toFixed(1)}s</td>
              <td title="depth budget at 50 bps slippage">{r.depthBid?.toFixed(2)} / {r.depthAsk?.toFixed(2)}</td>
              <td><span style={{ background: color(r.flag), color: "#000", padding: "1px 8px", borderRadius: 4, fontWeight: 700 }}>{r.flag}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p style={{ color: "#888" }}>No data — start the indexer (<code>pnpm --filter @kerb/indexer dev</code>).</p>}
    </div>
  );
}
