// Run: node --import ./prisma/os-userinfo.mjs tests/analysis/property-inputs-runtime.mjs
// Requires the existing optional prisma/package.json dev dependency (embedded-postgres).
import EmbeddedPostgres from '../../prisma/node_modules/embedded-postgres/dist/index.js';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
const port = Number(process.env.ANALYSIS_TEST_PORT ?? 55439);
const databaseDir = path.resolve('.data', `analysis-postgres-${randomUUID()}`);
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'analysis_test',
  password: 'analysis_test',
  port,
  persistent: true,
});
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://analysis_test:analysis_test@127.0.0.1:${port}/analysis_test?schema=public`,
  RUN_ANALYSIS_DB: '1',
};
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`Check failed: ${args.join(' ')}`);
}
try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('analysis_test');
  // Exercise an additive upgrade over a populated pre-property-ROI schema as well
  // as fresh migration installation. Never point these commands at app data.
  const baseline = path.join(databaseDir, 'baseline');
  mkdirSync(path.join(baseline, 'migrations'), { recursive: true });
  cpSync('prisma/schema.prisma', path.join(baseline, 'schema.prisma'));
  for (const entry of readdirSync('prisma/migrations')) {
    if (entry !== '20261019120000_property_roi_inputs')
      cpSync(path.join('prisma/migrations', entry), path.join(baseline, 'migrations', entry), {
        recursive: true,
      });
  }
  run([
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    path.join(baseline, 'schema.prisma'),
  ]);
  const client = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    await client.organization.create({
      data: { id: 'migration-existing', name: 'Existing organization' },
    });
    await client.property.create({
      select: { id: true },
      data: {
        id: 'migration-existing-property',
        organizationId: 'migration-existing',
        name: 'Existing home',
        type: 'SINGLE_UNIT',
        street: '1 Existing',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        purchasePrice: '234567.89',
      },
    });
  } finally {
    await client.$disconnect();
  }
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run(['node_modules/prisma/build/index.js', 'migrate', 'status']);
  const verified = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    const row = await verified.property.findUniqueOrThrow({
      where: { id: 'migration-existing-property' },
    });
    if (row.purchasePrice.toString() !== '234567.89')
      throw Error('Existing property changed during migration');
    if (row.roiInputs !== null) throw Error('Migration fabricated ROI inputs');
    console.log('Additive migration preserved the populated property and left ROI inputs unknown.');
  } finally {
    await verified.$disconnect();
  }
  run([
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.config.ts',
    'tests/analysis/property-inputs.test.ts',
    'tests/analysis/persistence.test.ts',
    'tests/roi/demo-provenance-db.test.ts',
    'tests/analysis/contract.test.ts',
  ]);
} finally {
  await postgres.stop();
  console.log(`Isolated test data retained at ${databaseDir}`);
}
