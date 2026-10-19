import assert from 'node:assert/strict';
import { db } from '../../src/lib/db/client';
import { loadRentProperties, resolveRentSelection } from '../../src/lib/analysis/rent';
import type { AuthSession } from '../../src/lib/auth/session';
async function main() {
  assert.equal(new URL(process.env.DATABASE_URL ?? '').port, '55436');
  const session = { role: 'MANAGER', organizationId: 'seed-rocket-rental' } as AuthSession;
  try {
    const properties = await loadRentProperties(session, db);
    assert.equal(properties.length, 8);
    assert.equal(
      (await loadRentProperties({ ...session, organizationId: 'foreign-org' }, db)).length,
      0,
    );
    assert.equal(
      resolveRentSelection(properties, 'demo-property-maple', 'demo-unit-elm-1').kind,
      'invalid',
    );
    const rollback = new Error('verification rollback');
    try {
      await db.$transaction(async (tx) => {
        await tx.property.update({
          where: { id: 'demo-property-maple' },
          data: { archivedAt: new Date() },
        });
        const scoped = await loadRentProperties(session, tx as typeof db);
        assert.equal(resolveRentSelection(scoped, 'demo-property-maple').kind, 'invalid');
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    assert.equal((await loadRentProperties(session, db)).length, 8);
    console.log(
      'PASS: actual authorized DTO, foreign organization, mismatched unit and archived property; archive probe rolled back.',
    );
  } finally {
    await db.$disconnect();
  }
}
void main();
