export default async function MarketPage({ params }: { params: Promise<{ coin: string }> }) {
  const { coin: raw } = await params;
  const coin = decodeURIComponent(raw);
  return (
    <div>
      <h1>{coin}</h1>
      <p style={{ color: "#888" }}>Chart (oracle / mark / composite overlaid, session bands) · metric cards · depth calculator · incidents.</p>
      <ul>
        <li>divergenceBps = (oraclePx − compositeRef) / compositeRef × 1e4</li>
        <li>markPremiumBps = (markPx − oraclePx) / oraclePx × 1e4</li>
        <li>depthBudget(side, 50bps) from live l2Book (20 levels)</li>
      </ul>
      <a href="/trade" style={{ color: "#58a6ff" }}>Open in terminal →</a>
    </div>
  );
}
