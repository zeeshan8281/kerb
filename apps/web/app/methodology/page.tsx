export default function Methodology() {
  return (
    <div>
      <h1>Methodology</h1>
      <h3>divergenceBps</h3><p>(oraclePx − compositeRef) / compositeRef × 1e4. compositeRef = median of live quotes (hl_crossdex, pyth), else last_close.</p>
      <h3>Flags</h3><p>RED if |div| ≥ 150 (env DIV_RED_BPS), or stale &gt; 120s while underlying not open, or transition ≤5min with |div| ≥ 50. AMBER if |div| ≥ 50 or underlying not open. Else GREEN.</p>
      <h3>Depth budget</h3><p>Walk l2Book (≤20 levels) from mid; largest size with avg fill within maxSlipBps. Default view 50 bps.</p>
      <h3>worstOffHoursMove</h3><p>Max |%| oracle move during non-open sessions in stored history; floor 19% for Korean equities (28 Jul 2026 SK Hynix reference).</p>
      <h3>Limits</h3><p>l2Book 20 levels; userFillsByTime 2000/req, 10k window (archiver backfills); candleSnapshot 5000 candles/interval; REST ~1200 weight/min.</p>
    </div>
  );
}
