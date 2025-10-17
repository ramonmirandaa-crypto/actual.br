// @ts-strict-ignore
import { getDatabase } from '../indexeddb';

import * as T from './index-types';
import { prepareForStorage, readFromStorage } from './secure-values';

import type { GlobalPrefsJson } from '../../../types/prefs';

export const init: T.Init = function () {};

export const getItem: T.GetItem = async function (key) {
  const db = await getDatabase();

  const transaction = db.transaction(['asyncStorage'], 'readonly');
  const objectStore = transaction.objectStore('asyncStorage');

  return new Promise((resolve, reject) => {
    const req = objectStore.get(key);
    req.onerror = e => reject(e);
    req.onsuccess = async e => {
      const target = e.target as IDBRequest<unknown>;
      const value = await readFromStorage(key, target.result);
      resolve(value as GlobalPrefsJson[typeof key]);
    };
  });
};

export const setItem: T.SetItem = async function (key, value) {
  const db = await getDatabase();

  const transaction = db.transaction(['asyncStorage'], 'readwrite');
  const objectStore = transaction.objectStore('asyncStorage');

  await new Promise((resolve, reject) => {
    prepareForStorage(key, value)
      .then(prepared => {
        const req = objectStore.put(prepared, key);
        req.onerror = e => reject(e);
        req.onsuccess = () => resolve(undefined);
      })
      .catch(reject);
    transaction.commit();
  });
};

export const removeItem: T.RemoveItem = async function (key) {
  const db = await getDatabase();

  const transaction = db.transaction(['asyncStorage'], 'readwrite');
  const objectStore = transaction.objectStore('asyncStorage');

  return new Promise((resolve, reject) => {
    const req = objectStore.delete(key);
    req.onerror = e => reject(e);
    req.onsuccess = () => resolve(undefined);
    transaction.commit();
  });
};

export async function multiGet<K extends readonly (keyof GlobalPrefsJson)[]>(
  keys: K,
): Promise<{ [P in K[number]]: GlobalPrefsJson[P] }> {
  const db = await getDatabase();

  const transaction = db.transaction(['asyncStorage'], 'readonly');
  const objectStore = transaction.objectStore('asyncStorage');

  const results = await Promise.all(
    keys.map(key => {
      return new Promise<[K[number], GlobalPrefsJson[K[number]]]>(
        (resolve, reject) => {
          const req = objectStore.get(key);
          req.onerror = e => reject(e);
          req.onsuccess = async e => {
            const target = e.target as IDBRequest<unknown>;
            const value = (await readFromStorage(
              key,
              target.result,
            )) as GlobalPrefsJson[K[number]];
            resolve([key, value]);
          };
        },
      );
    }),
  );

  transaction.commit();

  // Convert the array of tuples to an object with properly typed properties
  return results.reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as { [P in K[number]]: GlobalPrefsJson[P] },
  );
}

export const multiSet: T.MultiSet = async function (keyValues) {
  const db = await getDatabase();

  const transaction = db.transaction(['asyncStorage'], 'readwrite');
  const objectStore = transaction.objectStore('asyncStorage');

  const promise = Promise.all(
    keyValues.map(([key, value]) => {
      return new Promise((resolve, reject) => {
        prepareForStorage(key, value)
          .then(prepared => {
            const req = objectStore.put(prepared, key);
            req.onerror = e => reject(e);
            req.onsuccess = () => resolve(undefined);
          })
          .catch(reject);
      });
    }),
  );

  transaction.commit();
  await promise;
};

export const multiRemove: T.MultiRemove = async function (keys) {
  const db = await getDatabase();

  const transaction = db.transaction(['asyncStorage'], 'readwrite');
  const objectStore = transaction.objectStore('asyncStorage');

  const promise = Promise.all(
    keys.map(key => {
      return new Promise((resolve, reject) => {
        const req = objectStore.delete(key);
        req.onerror = e => reject(e);
        req.onsuccess = () => resolve(undefined);
      });
    }),
  );

  transaction.commit();
  await promise;
};
