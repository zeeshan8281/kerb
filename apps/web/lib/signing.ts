// Browser-only signing. Server never sees keys. [VERIFY] EIP-712 domain/field names against live HL docs before mainnet.
export const BUILDER_FEE_TENTHS_BP = Number(process.env.NEXT_PUBLIC_BUILDER_FEE_TENTHS_BP ?? 45);
export function builderAction(builderAddress: string, feeTenthsBp = BUILDER_FEE_TENTHS_BP) {
  return { b: builderAddress, f: feeTenthsBp }; // per HL docs: f in tenths of a bp, max 100
}
export async function encryptAgentKey(raw: Uint8Array, sig: Uint8Array): Promise<{ iv: string; ct: string }> {
  const keyMat = await crypto.subtle.importKey("raw", sig as unknown as BufferSource, "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(8), info: new TextEncoder().encode("kerb-agent") }, keyMat, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw as unknown as BufferSource);
  return { iv: Buffer.from(iv).toString("hex"), ct: Buffer.from(ct).toString("hex") };
}
export function agentName(expiresAt: number): string { return `kerb valid_until ${expiresAt}`; }
