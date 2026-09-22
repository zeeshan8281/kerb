import WebSocket from "ws";
import { wsUrl } from "@kerb/hl";

export interface StreamHealth { connected: boolean; lastMsgAt: number; gaps: { from: number; to: number }[]; reconnects: number }
export class MarketStream {
  private ws?: WebSocket; health: StreamHealth = { connected: false, lastMsgAt: 0, gaps: [], reconnects: 0 };
  private timer?: NodeJS.Timeout; private backoff = 1000;
  constructor(private network: "mainnet" | "testnet", private onMsg: (msg: unknown) => void) {}
  start() { this.connect(); this.timer = setInterval(() => this.watchdog(), 5000); }
  stop() { clearInterval(this.timer); this.ws?.close(); }
  private connect() {
    this.ws = new WebSocket(wsUrl(this.network));
    this.ws.on("open", () => {
      this.health.connected = true; this.backoff = 1000;
      this.ws!.send(JSON.stringify({ method: "subscribe", subscription: { type: "allDexsAssetCtxs" } }));
    });
    this.ws.on("message", (d) => {
      const now = Date.now();
      if (now - this.health.lastMsgAt > 10_000 && this.health.lastMsgAt > 0) this.health.gaps.push({ from: this.health.lastMsgAt, to: now });
      this.health.lastMsgAt = now;
      try { this.onMsg(JSON.parse(String(d))); } catch { /* ignore */ }
    });
    this.ws.on("close", () => {
      this.health.connected = false; this.health.reconnects++;
      const wait = this.backoff * (0.8 + Math.random() * 0.4);
      this.backoff = Math.min(30_000, this.backoff * 2);
      setTimeout(() => this.connect(), wait);
    });
  }
  subscribeBook(coin: string) { this.ws?.send(JSON.stringify({ method: "subscribe", subscription: { type: "l2Book", coin } })); }
  private watchdog() {
    if (Date.now() - this.health.lastMsgAt > 10_000 && this.health.connected) {
      // gap detection: surfaced via /healthz + board banner
    }
  }
}
