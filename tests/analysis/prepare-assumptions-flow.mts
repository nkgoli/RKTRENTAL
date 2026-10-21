// Prepares an ISOLATED database for assumptions-flow-runtime.mjs: a READY analysis, a saved
// DRAFT with a scenario, and a property whose rent and insurance are unknown.
// node --import ./prisma/os-userinfo.mjs --import tsx tests/analysis/prepare-assumptions-flow.mts <dbPort> <ready> <draft> <missing>
import { PrismaClient } from '@prisma/client';
import { analysisService } from '@/lib/analysis/service';
import { propertiesDb } from '@/lib/properties/data';

const [port, ready, draft, missing] = process.argv.slice(2);
if (!port || ['5433', '5434'].includes(port)) throw Error('Isolated database port required.');
const db = new PrismaClient({
  datasourceUrl: `postgresql://rocketrental:rocketrental@localhost:${port}/rocketrental?schema=public`,
});
const organizationId = 'seed-rocket-rental';
const analysis = analysisService({ organizationId, role: 'MANAGER' }, db);
try {
  for (const [id, status] of [
    [ready, 'READY'],
    [draft, 'DRAFT'],
  ] as const) {
    const loaded = await analysis.loadDraft(id);
    if (!loaded.ok) throw Error(`load ${id}: ${loaded.code}`);
    const payload = loaded.data.payload;
    if (status === 'DRAFT')
      payload.scenarios = [
        { id: 'flow-stress', name: 'Flow stress case', overrides: { income: { vacancyRate: 12 } } },
      ];
    const saved = await analysis.save({ propertyId: id, expectedRevision: 0, status, payload });
    console.log(id, status, saved.ok ? saved.data.revision : saved);
  }
  console.log(
    missing,
    await propertiesDb(organizationId, db).updateRoiInputs(missing, {
      version: 1,
      input: {},
      options: {},
      cleared: ['input.income.monthlyRent', 'input.expenses.insurance'],
    }),
  );
} finally {
  await db.$disconnect();
}
