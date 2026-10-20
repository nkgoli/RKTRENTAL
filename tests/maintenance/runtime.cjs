/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const runtime = path.join(__dirname, '.runtime');
process.env.DATABASE_URL =
  'postgresql://rocketrental:rocketrental@localhost:5433/rocketrental?schema=public';
process.env.ROCKETRENTAL_AUTH_SECRET = 'maintenance-synthetic-runtime-secret-2026-1019';
process.env.ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false';
process.env.STORAGE_LOCAL_DIR = path.join(runtime, 'storage');
process.env.NODE_ENV = 'development';
if (process.argv.includes('seed')) {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  const crypto = require('node:crypto');
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync('MaintenanceTest#2026', salt, 64);
  (async () => {
    const organizationId = 'maintenance-pages-synthetic-20261019';
    await db.organization.upsert({
      where: { id: organizationId },
      update: {},
      create: { id: organizationId, name: 'Maintenance synthetic QA' },
    });
    await db.user.upsert({
      where: { id: 'maintenance-pages-manager' },
      update: {},
      create: {
        id: 'maintenance-pages-manager',
        organizationId,
        name: 'Maintenance QA',
        email: 'maintenance-pages@example.test',
        role: 'MANAGER',
        passwordHash: `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`,
      },
    });
    await db.property.upsert({
      where: { id: 'maintenance-pages-property' },
      update: {},
      create: {
        id: 'maintenance-pages-property',
        organizationId,
        name: 'QA Court',
        type: 'MULTI_UNIT',
        street: '1 Test Lane',
        city: 'Test',
        state: 'CA',
        postalCode: '90001',
      },
    });
    await db.unit.upsert({
      where: { id: 'maintenance-pages-unit' },
      update: {},
      create: {
        id: 'maintenance-pages-unit',
        organizationId,
        propertyId: 'maintenance-pages-property',
        number: '4B',
      },
    });
    await db.vendor.createMany({
      data: [{ id: 'maintenance-pages-vendor', organizationId, name: 'QA Repairs' }],
      skipDuplicates: true,
    });
    console.log('Synthetic organization, manager, property, unit, vendor ready.');
    await db.$disconnect();
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
} else {
  fs.mkdirSync(runtime, { recursive: true });
  for (const name of ['src', 'public'])
    if (fs.existsSync(path.join(root, name)))
      fs.cpSync(path.join(root, name), path.join(runtime, name), { recursive: true });
  for (const name of ['package.json', 'next.config.ts'])
    fs.copyFileSync(path.join(root, name), path.join(runtime, name));
  fs.writeFileSync(
    path.join(runtime, 'tsconfig.json'),
    JSON.stringify({
      extends: '../../../tsconfig.json',
      compilerOptions: { paths: { '@/*': ['./src/*'] } },
      include: ['src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }),
  );
  console.log(JSON.stringify({ launcherPid: process.pid, source: root, runtime, port: 3294 }));
  process.chdir(runtime);
  process.argv = [
    process.execPath,
    require.resolve('next/dist/bin/next'),
    'dev',
    '-H',
    '127.0.0.1',
    '-p',
    '3294',
  ];
  require('next/dist/bin/next');
}
