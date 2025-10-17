import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('app storage directory initialization', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tempRoot: string | undefined;
  let dataDir: string | undefined;

  beforeEach(() => {
    originalEnv = process.env;
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'actual-storage-'));
    dataDir = path.join(tempRoot, 'data');
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      ACTUAL_DATA_DIR: dataDir,
    } as NodeJS.ProcessEnv;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();

    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('creates data, server and user directories when the app module loads', async () => {
    if (!dataDir) {
      throw new Error('Test data directory was not initialised');
    }

    await import('./load-config.js');

    const expectedServerFilesDir = path.join(dataDir, 'server-files');
    const expectedUserFilesDir = path.join(dataDir, 'user-files');

    expect(fs.existsSync(dataDir)).toBe(true);
    expect(fs.statSync(dataDir).isDirectory()).toBe(true);
    expect(fs.existsSync(expectedServerFilesDir)).toBe(true);
    expect(fs.statSync(expectedServerFilesDir).isDirectory()).toBe(true);
    expect(fs.existsSync(expectedUserFilesDir)).toBe(true);
    expect(fs.statSync(expectedUserFilesDir).isDirectory()).toBe(true);
  });
});
