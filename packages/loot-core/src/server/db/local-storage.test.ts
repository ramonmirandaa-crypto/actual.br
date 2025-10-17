import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { ensureLocalDocumentsDir, getLocalDocumentsDir } from './local-storage';

const ORIGINAL_DATA_DIR = process.env.ACTUAL_DATA_DIR;

describe('local-storage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-test-'));
    process.env.ACTUAL_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    process.env.ACTUAL_DATA_DIR = ORIGINAL_DATA_DIR;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('migrates legacy document directory into local storage', async () => {
    const legacyDir = path.join(tempDir, 'legacy-documents');
    await fs.mkdir(legacyDir, { recursive: true });
    const legacyFile = path.join(legacyDir, 'budget.txt');
    await fs.writeFile(legacyFile, 'migrated');

    const result = await ensureLocalDocumentsDir(legacyDir);

    expect(result.dir).toBe(getLocalDocumentsDir());
    expect(result.migrated).toBe(true);

    const migratedFile = path.join(result.dir, 'budget.txt');
    const contents = await fs.readFile(migratedFile, 'utf8');
    expect(contents).toBe('migrated');
  });

  it('returns existing local directory when already migrated', async () => {
    const localDir = getLocalDocumentsDir();
    await fs.mkdir(localDir, { recursive: true });

    const result = await ensureLocalDocumentsDir(localDir);

    expect(result.dir).toBe(localDir);
    expect(result.migrated).toBe(false);
  });
});
