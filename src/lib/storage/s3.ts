import { createHash, createHmac } from 'node:crypto';
import type { StorageAdapter, StorageObject } from './types';
import { StorageError } from './types';

export interface S3Config {
  endpoint: string; // e.g. http://localhost:9000 (MinIO) or https://s3.<region>.amazonaws.com
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}
type FetchFn = typeof fetch;
const sha256 = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const hmac = (k: Buffer | string, v: string) => createHmac('sha256', k).update(v).digest();
const awsEncode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

function canonicalQuery(searchParams: URLSearchParams): string {
  return [...searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join('&');
}

/** Minimal S3-compatible adapter (AWS S3 / MinIO) signed with SigV4; no SDK dependency. */
export class S3StorageAdapter implements StorageAdapter {
  readonly driver = 's3';
  constructor(
    private cfg: S3Config,
    private fetchFn: FetchFn = fetch,
  ) {}
  private host(): string {
    return new URL(this.cfg.endpoint).host;
  }
  private objectUrl(key: string): string {
    const enc = key.split('/').map(encodeURIComponent).join('/');
    const base = this.cfg.endpoint.replace(/\/$/, '');
    return this.cfg.forcePathStyle
      ? `${base}/${this.cfg.bucket}/${enc}`
      : `${base.replace('://', `://${this.cfg.bucket}.`)}/${enc}`;
  }
  private signingKey(date: string): Buffer {
    const kDate = hmac(`AWS4${this.cfg.secretAccessKey}`, date);
    const kRegion = hmac(kDate, this.cfg.region);
    const kService = hmac(kRegion, 's3');
    return hmac(kService, 'aws4_request');
  }
  private async request(
    method: string,
    key: string,
    body?: Uint8Array,
    contentType?: string,
  ): Promise<Response> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256(body ?? new Uint8Array());
    const headers: Record<string, string> = {
      host: this.host(),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType) headers['content-type'] = contentType;
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}\n`)
      .join('');
    const url = new URL(this.objectUrl(key));
    const canonical = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join(
      '\n',
    );
    const scope = `${date}/${this.cfg.region}/s3/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
    const signature = createHmac('sha256', this.signingKey(date)).update(toSign).digest('hex');
    headers['Authorization'] =
      `AWS4-HMAC-SHA256 Credential=${this.cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return this.fetchFn(url.toString(), {
      method,
      headers,
      body: body ? Buffer.from(body) : undefined,
    });
  }
  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const res = await this.request('PUT', key, body, contentType);
    if (!res.ok) throw new StorageError(`S3 PUT failed (${res.status})`, 'STORAGE', 502);
  }
  async get(key: string): Promise<StorageObject | null> {
    const res = await this.request('GET', key);
    if (res.status === 404) return null;
    if (!res.ok) throw new StorageError(`S3 GET failed (${res.status})`, 'STORAGE', 502);
    return {
      body: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? undefined,
    };
  }
  async delete(key: string): Promise<void> {
    const res = await this.request('DELETE', key);
    if (!res.ok && res.status !== 404)
      throw new StorageError(`S3 DELETE failed (${res.status})`, 'STORAGE', 502);
  }
  async getSignedUrl(
    key: string,
    opts: {
      method: 'GET' | 'PUT';
      expiresInSeconds?: number;
      contentType?: string;
      contentLength?: number;
    },
  ): Promise<string> {
    if (
      opts.method === 'PUT' &&
      (!opts.contentType || !Number.isSafeInteger(opts.contentLength) || opts.contentLength! <= 0)
    )
      throw new StorageError('Signed uploads require a content type and exact content length');
    const expires = Math.min(Math.max(opts.expiresInSeconds ?? 900, 1), 604800);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const scope = `${date}/${this.cfg.region}/s3/aws4_request`;
    const url = new URL(this.objectUrl(key));
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', `${this.cfg.accessKeyId}/${scope}`);
    url.searchParams.set('X-Amz-Date', amzDate);
    url.searchParams.set('X-Amz-Expires', String(expires));
    const canonicalHeaders: Record<string, string> = { host: this.host() };
    if (opts.method === 'PUT') {
      canonicalHeaders['content-length'] = String(opts.contentLength);
      canonicalHeaders['content-type'] = opts.contentType!;
    } else {
      // Even if another caller uses a direct GET URL, never ask S3 to render it as HTML.
      url.searchParams.set('response-content-disposition', 'attachment');
      url.searchParams.set('response-content-type', 'application/octet-stream');
    }
    const signedHeaders = Object.keys(canonicalHeaders).sort().join(';');
    const headers = Object.keys(canonicalHeaders)
      .sort()
      .map((name) => `${name}:${canonicalHeaders[name]!.trim()}\n`)
      .join('');
    url.searchParams.set('X-Amz-SignedHeaders', signedHeaders);
    const canonical = [
      opts.method,
      url.pathname,
      canonicalQuery(url.searchParams),
      headers,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
    const signature = createHmac('sha256', this.signingKey(date)).update(toSign).digest('hex');
    url.searchParams.set('X-Amz-Signature', signature);
    return url.toString();
  }
}
