export default function Alerts() {
  return (<div><h1>Alerts</h1><p style={{ color: "#888" }}>Connect Telegram, choose rules: divergence RED/AMBER, session transitions, liq-distance breaches. Bot token configured server-side; chat binding via /start code.</p><ol><li>Message the Kerb bot on Telegram</li><li>Paste the binding code here</li><li>Pick coins + thresholds</li></ol></div>);
}
