const DB_NAME = 'CardCreatorDB';
const DB_VERSION = 1;
const STORE_NAME = 'cardImages';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(true);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(false);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveImage = (id: string, image: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject('DB not initialized');
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(image, id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getImage = (id: string): Promise<Blob | undefined> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject('DB not initialized');
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result as Blob | undefined);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteImage = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject('DB not initialized');
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
