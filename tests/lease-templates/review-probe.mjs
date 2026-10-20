// Run from the isolated source snapshot; this probe performs no writes.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
try {
  await prisma.$queryRawUnsafe('SELECT 1');
  console.log(JSON.stringify(await prisma.leaseTemplate.findMany({ select: { id: true, name: true, version: true } })));
} finally { await prisma.$disconnect(); }
