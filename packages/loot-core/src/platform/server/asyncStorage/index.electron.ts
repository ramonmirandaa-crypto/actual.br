// @ts-strict-ignore
import * as fs from 'fs';
import { join } from 'path';

import * as lootFs from '../fs';

import * as T from './index-types';
import { prepareForStorage, readFromStorage } from './secure-values';

import type { GlobalPrefsJson } from '../../../types/prefs';

const getStorePath = () => join(lootFs.getDataDir(), 'global-store.json');
let store: Record<string, unknown>;
let persisted = true;

export const init: T.Init = function ({ persist = true } = {}) {
  if (persist) {
    try {
      store = JSON.parse(fs.readFileSync(getStorePath(), 'utf8'));
    } catch (e) {
      store = {};
    }
  } else {
    store = {};
  }

  persisted = persist;
};

function _saveStore(): Promise<void> {
  if (persisted) {
    return new Promise(function (resolve, reject) {
      fs.writeFile(
        getStorePath(),
        JSON.stringify(store),
        'utf8',
        function (err) {
          return err ? reject(err) : resolve();
        },
      );
    });
  }
}

export const getItem: T.GetItem = async function (key) {
  const value = await readFromStorage(key, store[key]);
  return value as GlobalPrefsJson[typeof key];
};

export const setItem: T.SetItem = async function (key, value) {
  store[key] = await prepareForStorage(key, value);
  await _saveStore();
};

export const removeItem: T.RemoveItem = function (key) {
  delete store[key];
  return _saveStore();
};

export async function multiGet<K extends readonly (keyof GlobalPrefsJson)[]>(
  keys: K,
): Promise<{ [P in K[number]]: GlobalPrefsJson[P] }> {
  const results = await Promise.all(
    keys.map(async key => {
      const value = await readFromStorage(key, store[key]);
      return [key, value as GlobalPrefsJson[typeof key]] as [
        typeof key,
        GlobalPrefsJson[typeof key],
      ];
    }),
  );

  // Convert the array of tuples to an object with properly typed properties
  return results.reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as { [P in K[number]]: GlobalPrefsJson[P] },
  );
}

export const multiSet: T.MultiSet = function (keyValues) {
  return Promise.all(
    keyValues.map(async ([key, value]) => {
      store[key] = await prepareForStorage(key, value);
    }),
  ).then(() => _saveStore());
};

export const multiRemove: T.MultiRemove = function (keys) {
  keys.forEach(function (key) {
    delete store[key];
  });
  return _saveStore();
};
