/** Disposable database self-check: DATABASE_URL must point to the maintenance QA database. */
import assert from 'node:assert/strict';
import { db } from '@/lib/db/client';
import { saveMaintenanceEditor } from '@/lib/maintenance/service';
import type { AuthSession } from '@/lib/auth/session';

async function main() {
  const organizationId = 'maintenance-pages-synthetic-20261019';
  const session = {
    organizationId,
    subjectId: 'maintenance-pages-manager',
    role: 'MANAGER',
  } as AuthSession;
  const scope = { propertyId: 'maintenance-pages-property', unitId: 'maintenance-pages-unit' };
  const request = await db.maintenanceRequest.create({
    data: { organizationId, ...scope, title: 'Disposable atomic-save check', priority: 'NORMAL' },
  });
  const input = {
    title: 'Updated',
    description: 'Atomic changes',
    priority: 'HIGH' as const,
    vendorId: 'maintenance-pages-vendor',
    status: 'IN_PROGRESS' as const,
    updatedAt: request.updatedAt.toISOString(),
  };
  let checks = 0;
  async function unchanged() {
    const current = await db.maintenanceRequest.findUniqueOrThrow({ where: { id: request.id } });
    assert.equal(current.title, request.title);
    assert.equal(current.status, 'NEW');
    assert.equal(current.vendorId, null);
    assert.equal(
      await db.maintenanceEvent.count({ where: { maintenanceRequestId: request.id } }),
      0,
    );
    checks++;
  }
  try {
    for (const invalidScope of [
      { propertyId: 'foreign', unitId: scope.unitId },
      { propertyId: scope.propertyId, unitId: 'foreign' },
    ]) {
      await assert.rejects(saveMaintenanceEditor(session, request.id, input, invalidScope));
      await unchanged();
    }
    await assert.rejects(
      saveMaintenanceEditor({ ...session, role: 'TENANT' }, request.id, input, scope),
    );
    await unchanged();
    await assert.rejects(
      saveMaintenanceEditor({ ...session, organizationId: 'foreign' }, request.id, input, scope),
    );
    await unchanged();
    await assert.rejects(
      saveMaintenanceEditor(session, request.id, { ...input, vendorId: 'foreign' }, scope),
    );
    await unchanged();
    // The update succeeds, then the event FK fails. The real PostgreSQL transaction must roll back.
    await assert.rejects(
      saveMaintenanceEditor({ ...session, subjectId: 'missing-actor' }, request.id, input, scope),
    );
    await unchanged();
    await saveMaintenanceEditor(session, request.id, input, scope);
    let current = await db.maintenanceRequest.findUniqueOrThrow({ where: { id: request.id } });
    assert.equal(current.title, 'Updated');
    assert.equal(current.vendorId, input.vendorId);
    assert.equal(current.status, 'IN_PROGRESS');
    checks++;
    const events = await db.maintenanceEvent.count({ where: { maintenanceRequestId: request.id } });
    assert.equal(events, 3);
    await saveMaintenanceEditor(session, request.id, input, scope);
    assert.equal(
      await db.maintenanceEvent.count({ where: { maintenanceRequestId: request.id } }),
      events,
    );
    checks++;
    await assert.rejects(
      saveMaintenanceEditor(session, request.id, { ...input, title: 'Stale overwrite' }, scope),
    );
    assert.equal(
      (await db.maintenanceRequest.findUniqueOrThrow({ where: { id: request.id } })).title,
      'Updated',
    );
    checks++;
    await saveMaintenanceEditor(
      session,
      request.id,
      { ...input, status: 'DONE', updatedAt: current.updatedAt.toISOString() },
      scope,
    );
    current = await db.maintenanceRequest.findUniqueOrThrow({ where: { id: request.id } });
    assert.ok(current.completedAt);
    checks++;
    await saveMaintenanceEditor(
      session,
      request.id,
      { ...input, updatedAt: current.updatedAt.toISOString() },
      scope,
    );
    assert.equal(
      (await db.maintenanceRequest.findUniqueOrThrow({ where: { id: request.id } })).completedAt,
      null,
    );
    checks++;
    console.log(
      `${checks} PostgreSQL checks passed: scope, permissions, validation, real rollback, persistence, retry deduplication, stale conflict, completion and reopening.`,
    );
  } finally {
    await db.maintenanceRequest.delete({ where: { id: request.id } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
