export interface AlertRule { id: string; kind: "divergence" | "session" | "liq"; coin?: string; address?: string; params: Record<string, number | string>; chatId: string }
export interface AlertEvent { kind: string; coin?: string; text: string; at: number }
export function matchRules(rules: AlertRule[], ev: AlertEvent): AlertRule[] {
  return rules.filter((r) => {
    if (r.kind !== ev.kind) return false;
    if (r.coin && ev.coin && r.coin !== ev.coin) return false;
    return true;
  });
}
export async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  if (!botToken) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return r.ok;
  } catch { return false; }
}
export function draftIncidentText(coin: string, peakDivBps: number, session: string): string {
  return `🚨 $${coin} divergence ${peakDivBps.toFixed(0)} bps while underlying ${session}. Oracle vs reference drifting — check size before signing. (Kerb draft — human posts)`;
}
