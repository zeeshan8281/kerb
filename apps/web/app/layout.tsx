import type { Metadata } from "next";
export const metadata: Metadata = { title: "Kerb — HIP-3 Divergence Terminal" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0e14", color: "#e6edf3", fontFamily: "ui-monospace, monospace", margin: 0 }}>
        <header style={{ padding: "12px 20px", borderBottom: "1px solid #222", display: "flex", gap: 16 }}>
          <b>KERB</b>
          <a href="/" style={{ color: "#9fb3c8" }}>Board</a>
          <a href="/trade" style={{ color: "#9fb3c8" }}>Trade</a>
          <a href="/archive" style={{ color: "#9fb3c8" }}>Archive</a>
          <a href="/alerts" style={{ color: "#9fb3c8" }}>Alerts</a>
          <a href="/methodology" style={{ color: "#9fb3c8" }}>Methodology</a>
        </header>
        <main style={{ padding: 20, maxWidth: 1200 }}>{children}</main>
        <footer style={{ padding: 12, color: "#666", fontSize: 12 }}>Information only. Kerb cannot prevent liquidation. · <span id="fresh">updated just now</span></footer>
      </body>
    </html>
  );
}
