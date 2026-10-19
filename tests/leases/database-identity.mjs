import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
export const checkout = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const dataDirectory = path.join(checkout, '.playwright-mcp', 'lease-postgres');
export const databaseUrl =
  'postgresql://rocketrental:rocketrental@127.0.0.1:55494/rocketrental?schema=public';
export async function assertLeaseDatabase(db) {
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (
    !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    target.port !== '55494' ||
    target.pathname !== '/rocketrental'
  )
    throw new Error('Requires the reserved lease review database on port 55494');
  const [directory] = await db.$queryRawUnsafe('SHOW data_directory');
  const [port] = await db.$queryRawUnsafe('SHOW port');
  const actual = fs.realpathSync(directory.data_directory);
  if (
    actual.toLowerCase() !== fs.realpathSync(dataDirectory).toLowerCase() ||
    String(port.port) !== '55494'
  )
    throw new Error('Lease database data-directory/port identity mismatch');
  return { dataDirectory: actual, port: Number(port.port) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = new PrismaClient();
  try {
    console.log(JSON.stringify(await assertLeaseDatabase(db)));
  } finally {
    await db.$disconnect();
  }
}
