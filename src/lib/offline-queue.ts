// Simple IndexedDB-backed offline submission queue.
// Used by Home page to keep submissions if user is offline.
const DB_NAME = "qadi-yonis";
const STORE = "pending_submissions";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export type QueuedSubmission = {
  id?: number;
  payload: unknown;
  createdAt: number;
};

export async function enqueueSubmission(payload: unknown) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ payload, createdAt: Date.now() });
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function listQueue(): Promise<QueuedSubmission[]> {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result as QueuedSubmission[]);
    r.onerror = () => rej(r.error);
  });
}

export async function clearQueueItem(id: number) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
