// ── Durable contribution outbox (IndexedDB) ──────────────────────────────────
// A recorded contribution is NEVER lost. Every submission — audio blob + text — is
// persisted here the instant the user taps send, BEFORE any network call. It is
// removed only once the server confirms (+points). So a page reload, a crash, a
// tab close, or navigating away mid-upload cannot drop the work: on the next
// contribute-page load the pending items are reloaded and replayed automatically.
//
// All operations fail soft: if IndexedDB is unavailable (private mode, old browser),
// they no-op and the in-memory queue still covers the active session.

const DB_NAME = "elson-outbox";
const STORE = "pending";
const VERSION = 1;

export type OutboxRecord = {
  id: string;          // unique key: `${phraseId}-${timestamp}`
  phraseId: number;
  text: string;
  blob: Blob;
  durationMs: number;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function outboxAdd(rec: OutboxRecord): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* IndexedDB unavailable — in-memory queue still covers this session */ }
}

export async function outboxRemove(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* ignore */ }
}

export async function outboxAll(): Promise<OutboxRecord[]> {
  try {
    const db = await openDb();
    const items = await new Promise<OutboxRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as OutboxRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    // Oldest first → preserve submission order on replay.
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch { return []; }
}
