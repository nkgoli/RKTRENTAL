import path from 'node:path';
import { LocalStorageAdapter } from './local';
import { S3StorageAdapter } from './s3';
import type { StorageAdapter } from './types';
import { StorageError } from './types';

export type StorageEnv = Record<string, string | undefined>;
/**
 * Env (no secrets in repo; set in deployment):
 * STORAGE_DRIVER=local|s3 (default: s3 when S3_BUCKET set, else local)
 * STORAGE_LOCAL_DIR (default .data/storage) | S3_ENDPOINT, S3_BUCKET,
 * S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE
 * AWS_* fallbacks accepted for the S3_* values.
 */
export function createStorageAdapter(env: StorageEnv = process.env): StorageAdapter {
  const driver = (
    env.STORAGE_DRIVER ?? (env.S3_BUCKET || env.AWS_S3_BUCKET ? 's3' : 'local')
  ).toLowerCase();
  if (driver === 'local') {
    return new LocalStorageAdapter(
      env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), '.data', 'storage'),
    );
  }
  if (driver === 's3') {
    const bucket = env.S3_BUCKET ?? env.AWS_S3_BUCKET;
    const accessKeyId = env.S3_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY;
    const region = env.S3_REGION ?? env.AWS_REGION ?? 'us-east-1';
    const endpoint = env.S3_ENDPOINT ?? `https://s3.${region}.amazonaws.com`;
    if (!bucket || !accessKeyId || !secretAccessKey)
      throw new StorageError(
        'S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
        'CONFIG',
        500,
      );
    return new S3StorageAdapter({
      endpoint,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      forcePathStyle:
        (env.S3_FORCE_PATH_STYLE ?? (env.S3_ENDPOINT ? 'true' : 'false')).toLowerCase() === 'true',
    });
  }
  throw new StorageError(`Unknown STORAGE_DRIVER "${driver}"`, 'CONFIG', 500);
}
let cached: StorageAdapter | undefined;
export function getStorage(): StorageAdapter {
  return (cached ??= createStorageAdapter());
}
