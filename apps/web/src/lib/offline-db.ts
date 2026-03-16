const DB_NAME = 'cedisense-offline';
const DB_VERSION = 1;

interface CachedResponse {
  path: string;
  data: unknown;
  timestamp: number;
  ttl: number;
}

export interface SyncQueueItem {
  id?: number;
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('apiCache')) {
          db.createObjectStore('apiCache', { keyPath: 'path' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { autoIncrement: true, keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null; // Reset on error so next call retries
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

export async function getCachedResponse<T>(path: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('apiCache', 'readonly');
    const store = tx.objectStore('apiCache');
    const req = store.get(path);
    req.onsuccess = () => {
      const entry = req.result as CachedResponse | undefined;
      if (!entry) { resolve(null); return; }
      if (Date.now() - entry.timestamp > entry.ttl) { resolve(null); return; }
      resolve(entry.data as T);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function setCachedResponse(path: string, data: unknown, ttl: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('apiCache', 'readwrite');
    const store = tx.objectStore('apiCache');
    store.put({ path, data, timestamp: Date.now(), ttl } as CachedResponse);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as SyncQueueItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
