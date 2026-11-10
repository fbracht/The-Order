import { Item } from '../types';

/**
 * Keeps uploaded images in the browser's own database (IndexedDB) so an image
 * ranking survives a refresh. The images never leave the device.
 *
 * Uploaded images are shown through object URLs, which stop working when the
 * page reloads. Here the files themselves are stored under their item id, and
 * fresh object URLs are made from them on the next visit.
 */
const DB_NAME = 'the-order';
const STORE = 'images';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Replaces whatever was stored with the images of these items. Throws if the browser refuses (for example when storage is full). */
export async function saveImages(items: Item[]): Promise<void> {
  const blobs = await Promise.all(
    items.map(async item => ({ id: item.id, blob: await (await fetch(item.imageUrl!)).blob() }))
  );
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    store.clear();
    blobs.forEach(({ id, blob }) => store.put(blob, id));
    await done(transaction);
  } finally {
    db.close();
  }
}

/** Returns a fresh object URL per stored image id, or null if any is missing. */
export async function loadImageUrls(ids: string[]): Promise<Map<string, string> | null> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE, 'readonly');
    const store = transaction.objectStore(STORE);
    const blobs = await Promise.all(
      ids.map(id => new Promise<Blob | undefined>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result as Blob | undefined);
        request.onerror = () => reject(request.error);
      }))
    );
    if (blobs.some(blob => !blob)) return null;
    return new Map(ids.map((id, index) => [id, URL.createObjectURL(blobs[index]!)]));
  } finally {
    db.close();
  }
}

export async function clearImages(): Promise<void> {
  try {
    const db = await openDb();
    try {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).clear();
      await done(transaction);
    } finally {
      db.close();
    }
  } catch {
    // Nothing useful to do: the store is only a convenience.
  }
}
