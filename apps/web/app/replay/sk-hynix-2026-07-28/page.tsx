"use client";
import { useState } from "react";
export default function Replay() {
  const [lev, setLev] = useState(5);
  const [size, setSize] = useState(1000);
  const drop = 19; // SK Hynix 28 Jul 2026 reference floor
  const liqAt = 100 / lev; // approx % adverse move to liquidation (isolated, no buffer)
  const survives = liqAt > drop;
  return (
    <div>
      <h1>Replay: SK Hynix 28 Jul 2026</h1>
      <p style={{ color: "#888" }}>Base series: HL 1h candles (1m/5m unavailable — outside the 5000-candle window as of Sep 2026). Reference off-hours drop: −19%.</p>
      <label>Leverage <input type="number" value={lev} onChange={(e) => setLev(Number(e.target.value))} style={{ width: 60, background: "#111", color: "#eee", border: "1px solid #444" }} />x</label>{" "}
      <label>Size USDC <input type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ width: 100, background: "#111", color: "#eee", border: "1px solid #444" }} /></label>
      <p>Liquidation ≈ {liqAt.toFixed(1)}% adverse move. 19% drop → <b style={{ color: survives ? "#3fb950" : "#ff5f56" }}>{survives ? "survives" : "LIQUIDATED"}</b>. Est. loss at −19%: ${(size * drop / 100).toFixed(0)} on ${size}.</p>
      <p style={{ color: "#888", fontSize: 12 }}>Information only. Kerb cannot prevent liquidation.</p>
    </div>
  );
}
