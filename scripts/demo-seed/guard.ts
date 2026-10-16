export function assertDemoTarget(nodeEnv: string | undefined, databaseUrl: string | undefined, forceDemo: boolean) {
  if (nodeEnv === 'production') throw new Error('Demo seed is disabled when NODE_ENV=production.');
  if (!databaseUrl) throw new Error('DATABASE_URL is required for demo:seed.');
  let url: URL;
  try { url = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL is invalid.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Demo seed requires PostgreSQL.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const demo = host === 'demo' || host.endsWith('.demo');
  if (!local && !demo && !forceDemo) {
    throw new Error('Refusing to reset a database outside localhost or a .demo host. Pass --force-demo to override this host check.');
  }
}
