/** Read-only verification of this Task's isolated runtime; data stays on disk. */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PayloadSchema, calculatePayload } from '../../src/lib/analysis';

const db = new PrismaClient({
  datasourceUrl:
    'postgresql://roi_review:roi_review@127.0.0.1:55568/combined_analysis_review?schema=public',
});
const directory = path.resolve('.data/combined-analysis-review');
const baselineFile = path.join(directory, 'verification-baseline.json');
const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
try {
  const identity = await db.$queryRaw<{ database: string; port: number; directory: string }[]>`
    SELECT current_database() AS database, inet_server_port() AS port,
           current_setting('data_directory') AS directory`;
  assert.equal(identity[0].database, 'combined_analysis_review');
  assert.equal(identity[0].port, 55568);
  assert.equal(path.resolve(identity[0].directory), path.join(directory, 'postgres'));
  const leases = await db.lease.findMany({ orderBy: { id: 'asc' } });
  const units = await db.unit.findMany({ orderBy: { id: 'asc' } });
  const states = await db.roiAnalysisState.findMany({ orderBy: { propertyId: 'asc' } });
  const maple = states.find((state) => state.propertyId === 'seed-property-maple');
  assert.ok(maple);
  const p = PayloadSchema.parse(maple.payload);
  const state = {
    leases: { count: leases.length, hash: hash(leases) },
    units: { count: units.length, hash: hash(units) },
    base: hash({ input: p.input, options: p.options }),
    otherAnalyses: hash(states.filter((row) => row.propertyId !== maple.propertyId)),
  };
  if (process.argv.includes('baseline')) {
    writeFileSync(baselineFile, JSON.stringify(state, null, 2));
    console.log('Captured isolated baseline hashes; no business data exported.');
  } else {
    assert.deepEqual(state, JSON.parse(readFileSync(baselineFile, 'utf8')));
    assert.ok(p.scenarios.some((scenario) => scenario.name === 'Optimistic'));
    assert.ok(p.scenarios.some((scenario) => scenario.name === 'Combined custom'));
    const result = calculatePayload(p);
    console.log(
      JSON.stringify(
        {
          database: identity[0].database,
          port: identity[0].port,
          directory: identity[0].directory,
          revision: maple.revision,
          status: maple.status,
          scenarios: p.scenarios.map((scenario) => ({
            name: scenario.name,
            overrides: scenario.overrides,
          })),
          baseYear1CashFlow: result.base.annualCashflows[0].cashFlow,
          scenarioYear1CashFlows: result.scenarios.map((scenario) => ({
            name: scenario.name,
            cashFlow: scenario.result.annualCashflows[0].cashFlow,
          })),
          unchangedLeases: leases.length,
          unchangedUnits: units.length,
          baseAndOtherPropertiesUnchanged: true,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await db.$disconnect();
}
