import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageAdapter, StorageObject } from './types';
import { StorageError } from './types';

export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = 'local';
  constructor(private root: string) {}
  private resolve(key: string): string {
    const parts = key.replace(/\\/g, '/').split('/');
    if (parts.some((p) => p === '..'))
      throw new StorageError('Invalid storage key', 'VALIDATION', 400);
    const safe = parts.filter((p) => p && p !== '.').join('/');
    if (!safe) throw new StorageError('Invalid storage key', 'VALIDATION', 400);
    const full = path.resolve(this.root, safe);
    const rootResolved = path.resolve(this.root);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep))
      throw new StorageError('Invalid storage key', 'VALIDATION', 400);
    return full;
  }
  async put(key: string, body: Uint8Array, _contentType?: string): Promise<void> {
    void _contentType;
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  async get(key: string): Promise<StorageObject | null> {
    try {
      const body = await readFile(this.resolve(key));
      return { body: new Uint8Array(body) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
  async getSignedUrl(
    _key?: string,
    _opts?: { method: 'GET' | 'PUT'; expiresInSeconds?: number; contentType?: string },
  ): Promise<string | null> {
    void _key;
    void _opts;
    return null; // Local dev streams through the API instead.
  }
}
