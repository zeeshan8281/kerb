// Agent-key persistence (browser IndexedDB). The agent private key stays on-device.
// NOTE: v1 stores the agent key as a hex string in IndexedDB. The PRD's AES-GCM
// (key derived from a wallet signature) encryption is a hardening TODO before mainnet.
const DB = "kerb";
const STORE = "agents";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeAgent(master: string, agent: { privateKey: `0x${string}`; address: `0x${string}`; expiresAt: number }): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(agent, master.toLowerCase());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAgent(master: string): Promise<{ privateKey: `0x${string}`; address: `0x${string}`; expiresAt: number } | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(master.toLowerCase());
    req.onsuccess = () => resolve(req.result as any);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAgent(master: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(master.toLowerCase());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
