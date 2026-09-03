/**
 * 🛡️ IndexedDB 高性能大容量异步快照存储引擎
 * 彻底消除 LocalStorage 5MB 配额瓶颈，支持 500MB+ 快照池与极速读写
 */
const DB_NAME = "YMIND_PRO_STORAGE_DB";
const DB_VERSION = 1;
const STORE_SNAPSHOTS = "snapshots";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveSnapshot(snapshot) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
    tx.objectStore(STORE_SNAPSHOTS).put(snapshot);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn("IDB Save Fail", err);
    return false;
  }
}

export async function idbGetAllSnapshots() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, "readonly");
    const req = tx.objectStore(STORE_SNAPSHOTS).getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        res(list);
      };
      req.onerror = () => rej(req.error);
    });
  } catch {
    return [];
  }
}

export async function idbDeleteSnapshot(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
    tx.objectStore(STORE_SNAPSHOTS).delete(id);
  } catch {}
}

export async function idbClearSnapshots() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
    tx.objectStore(STORE_SNAPSHOTS).clear();
  } catch {}
}
