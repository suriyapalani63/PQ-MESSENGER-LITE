/**
 * fileStore.ts — IndexedDB storage for file blobs (cross-tab file sharing).
 *
 * ⚠️  SAME-ORIGIN CROSS-TAB DEMO ONLY.
 *   • File blobs are stored in IndexedDB so both sender and receiver tabs
 *     can access them without serializing into localStorage.
 *   • Maximum file size: 5 MB (demo limit).
 *   • Object URLs must be revoked after download / component cleanup.
 *
 * IndexedDB database: "pq_file_store"
 * Object store:       "files"
 * Key:                fileId (string)
 * Value:              { fileId, name, mimeType, blob, createdAt }
 */

const DB_NAME = 'pq_file_store';
const DB_VERSION = 1;
const STORE_NAME = 'files';

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export interface StoredFile {
  fileId: string;
  name: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

// ─── Allowed MIME types (demo whitelist) ───────────────────────────

const ALLOWED_MIME_PREFIXES = [
  'text/',
  'image/',
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
];

export function isAllowedMimeType(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function validateFileName(name: string): boolean {
  if (!name || name.length > 255) return false;
  // Block path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return true;
}

// ─── DB initialization ────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────

/** Generate a unique file ID. */
export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Store a file blob in IndexedDB. Returns the fileId. */
export async function storeFile(
  fileId: string,
  name: string,
  mimeType: string,
  blob: Blob,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredFile = {
      fileId,
      name,
      mimeType,
      blob,
      createdAt: Date.now(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Retrieve a file blob from IndexedDB. */
export async function getFile(fileId: string): Promise<StoredFile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(fileId);
    req.onsuccess = () => resolve((req.result as StoredFile) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Delete a file from IndexedDB. */
export async function deleteFile(fileId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
