import { promises as fs } from 'fs';
import * as path from 'path';

import { logger } from '../../platform/server/log';
import * as lootFs from '../../platform/server/fs';

export type LocalDocumentsResult = {
  dir: string;
  migrated: boolean;
};

const LOCAL_DOCUMENTS_DIR_NAME = 'documents';

async function pathExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch (error) {
    return false;
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyRecursive(source: string, destination: string) {
  const stats = await fs.lstat(source);

  if (stats.isDirectory()) {
    await ensureDir(destination);
    const entries = await fs.readdir(source);
    for (const entry of entries) {
      await copyRecursive(
        path.join(source, entry),
        path.join(destination, entry),
      );
    }
  } else if (stats.isFile()) {
    await ensureDir(path.dirname(destination));
    await fs.copyFile(source, destination);
  }
}

function normalize(filepath: string): string {
  return path.resolve(filepath);
}

export function getLocalDocumentsDir(): string {
  const baseDir = lootFs.getDataDir();
  if (!baseDir) {
    throw new Error('ACTUAL_DATA_DIR environment variable must be defined');
  }

  return lootFs.join(baseDir, LOCAL_DOCUMENTS_DIR_NAME);
}

export async function ensureLocalDocumentsDir(
  existingDir: string | null,
): Promise<LocalDocumentsResult> {
  const targetDir = getLocalDocumentsDir();
  await ensureDir(targetDir);

  if (!existingDir) {
    return { dir: targetDir, migrated: false };
  }

  const normalizedExisting = normalize(existingDir);
  const normalizedTarget = normalize(targetDir);

  if (normalizedExisting === normalizedTarget) {
    return { dir: targetDir, migrated: false };
  }

  if (!(await pathExists(existingDir))) {
    return { dir: targetDir, migrated: false };
  }

  logger.log(
    `Migrating document directory from ${normalizedExisting} to ${normalizedTarget}`,
  );

  await copyRecursive(existingDir, targetDir);

  return { dir: targetDir, migrated: true };
}
