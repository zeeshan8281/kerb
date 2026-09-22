"use client";
import { TradeTerminal } from "./terminal";

export default function TradePage() {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <div>
        <h1>Terminal</h1>
        <p style={{ color: "#888" }}>Trading is not configured yet. Set <code>NEXT_PUBLIC_PRIVY_APP_ID</code> (and <code>NEXT_PUBLIC_BUILDER_ADDRESS</code>) to enable wallet connect + order placement.</p>
      </div>
    );
  }
  return <TradeTerminal />;
}