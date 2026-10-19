import assert from 'node:assert/strict';
import { db } from '../../src/lib/db/client';
import {
  applyMarketRent,
  clearUnitComps,
  fetchComps,
  listPricingUnits,
  subjectFacts,
} from '../../src/lib/comps/service';
import { parseFilters } from '../../src/lib/comps/core';

async function main() {
  assert.equal(new URL(process.env.DATABASE_URL ?? '').port, '55435');
  const before = await db.unit.findUniqueOrThrow({ where: { id: 'seed-unit-maple-7' } });
  assert.equal((await listPricingUnits('verification-foreign-organization')).length, 0);
  assert.deepEqual(
    await applyMarketRent('verification-foreign-organization', before.id, '9999', {
      id: 'verification-foreign-manager',
      name: 'Foreign manager',
    }),
    { ok: false, error: 'Unit not found.' },
  );
  assert.deepEqual(await db.unit.findUniqueOrThrow({ where: { id: before.id } }), before);
  const unit = (await listPricingUnits(before.organizationId)).find((row) => row.id === before.id)!;
  const subject = subjectFacts(unit, 2);
  const filters = parseFilters({}, subject);
  let calls = 0;
  const options = {
    ttlMs: 60_000,
    provider: {
      name: 'Sandbox',
      search: async () => {
        calls++;
        return [];
      },
    },
  };
  await fetchComps(before.organizationId, before.id, subject, filters, options);
  await fetchComps('verification-foreign-organization', before.id, subject, filters, options);
  assert.equal(calls, 2, 'Organizations must not share cached comps');
  clearUnitComps('verification-foreign-organization', before.id);
  assert.equal(
    (await fetchComps(before.organizationId, before.id, subject, filters, options)).cached,
    true,
  );
  assert.equal(
    (await fetchComps('verification-foreign-organization', before.id, subject, filters, options))
      .cached,
    false,
  );
  assert.equal(calls, 3, 'Refresh clears only the selected organization cache');
  assert.deepEqual(await db.unit.findUniqueOrThrow({ where: { id: before.id } }), before);
  console.log(
    'PASS: foreign-organization listing/apply rejected; cache and refresh isolated; complete unit row unchanged',
  );
}
main().finally(() => db.$disconnect());
