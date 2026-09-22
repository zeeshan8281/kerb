export interface FillRow { time: number; coin: string; side: string; dir?: string; px: number; sz: number; closedPnl?: number; fee?: number; feeToken?: string; builderFee?: number; hash?: string; oid?: number | bigint; tid: number | bigint }
export interface FundingRow { time: number; coin: string; usdc: number; fundingRate?: number }
function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
export function exportGeneric(fills: FillRow[], fundings: FundingRow[]): string {
  const rows: (string | number)[][] = [
    ...fills.map((f) => ["fill", new Date(f.time).toISOString(), f.coin, f.side, f.dir ?? "", f.px, f.sz, f.closedPnl ?? 0, f.fee ?? 0, f.hash ?? ""] as (string | number)[]),
    ...fundings.map((f) => ["funding", new Date(f.time).toISOString(), f.coin, "", "", 0, 0, f.usdc, 0, ""] as (string | number)[]),
  ];
  return toCsv(["type", "time", "coin", "side", "dir", "px", "sz", "pnl_or_usdc", "fee", "hash"], rows);
}
/** Koinly custom CSV: Date,Sent Amount,Sent Currency,Received Amount,Received Currency,Fee Amount,Fee Currency,Label */
export function exportKoinly(fills: FillRow[], fundings: FundingRow[]): string {
  const rows: (string | number)[][] = [];
  for (const f of fills) {
    const notional = f.px * f.sz;
    rows.push([new Date(f.time).toISOString(), notional, "USDC", f.sz, f.coin, f.fee ?? 0, f.feeToken ?? "USDC", "trade"]);
  }
  for (const f of fundings) {
    rows.push([new Date(f.time).toISOString(), f.usdc < 0 ? -f.usdc : "", f.usdc < 0 ? "USDC" : "", f.usdc > 0 ? f.usdc : "", f.usdc > 0 ? "USDC" : "", "", "", "funding"]);
  }
  return toCsv(["Date", "Sent Amount", "Sent Currency", "Received Amount", "Received Currency", "Fee Amount", "Fee Currency", "Label"], rows);
}
/** KoinX draft (derivatives): same shape, tagged draft. */
export function exportKoinXDraft(fills: FillRow[], fundings: FundingRow[]): string {
  const header = "# KoinX draft — for your CA. Tax treatment of perps in India is contested.\n";
  return header + exportGeneric(fills, fundings);
}
