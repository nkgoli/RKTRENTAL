import { buildLeaseAccessWhere } from '@/lib/auth/policy';
import type { FileActor, FileTarget, StoredDocument } from './types';
import { forbiddenError } from './types';

/**
 * Small access interface wired to the parallel auth helpers.
 * Tests inject a stub implementation (see tests/storage); production uses
 * PrismaFileAccess below, which reuses buildLeaseAccessWhere for leases.
 */
export interface FileAccess {
  canAccessTarget(actor: FileActor, target: FileTarget): Promise<boolean>;
  canAccessDocument(actor: FileActor, doc: StoredDocument): Promise<boolean>;
}
export async function assertTargetAccess(a: FileAccess, actor: FileActor, t: FileTarget) {
  if (!(await a.canAccessTarget(actor, t))) throw forbiddenError();
}
export async function assertDocumentAccess(a: FileAccess, actor: FileActor, d: StoredDocument) {
  if (!(await a.canAccessDocument(actor, d))) throw forbiddenError();
}

export interface TargetLookup {
  leaseExists(input: {
    leaseId: string;
    organizationId: string;
    tenantId?: string;
  }): Promise<boolean>;
  propertyExists(input: { propertyId: string; organizationId: string }): Promise<boolean>;
  unitExists(input: { unitId: string; organizationId: string }): Promise<boolean>;
}

/** Pure rule over a TargetLookup — the unit-tested core. */
export function createFileAccess(lookup: TargetLookup): FileAccess {
  async function canAccessTarget(actor: FileActor, target: FileTarget): Promise<boolean> {
    if (actor.role === 'MANAGER' || actor.role === 'OWNER') {
      if (target.kind === 'lease')
        return lookup.leaseExists({ leaseId: target.id, organizationId: actor.organizationId });
      if (target.kind === 'property')
        return lookup.propertyExists({
          propertyId: target.id,
          organizationId: actor.organizationId,
        });
      return lookup.unitExists({ unitId: target.id, organizationId: actor.organizationId });
    }
    if (actor.role === 'TENANT') {
      // Tenants: only files of their own lease.
      if (target.kind !== 'lease' || !actor.tenantId) return false;
      return lookup.leaseExists({
        leaseId: target.id,
        organizationId: actor.organizationId,
        tenantId: actor.tenantId,
      });
    }
    return false; // ADMIN and unknown roles get no file access, matching the lease API.
  }
  return {
    canAccessTarget,
    async canAccessDocument(actor, doc) {
      if (doc.organizationId !== actor.organizationId) return false;
      if (doc.leaseId) return canAccessTarget(actor, { kind: 'lease', id: doc.leaseId });
      if (doc.propertyId) return canAccessTarget(actor, { kind: 'property', id: doc.propertyId });
      if (doc.unitId) return canAccessTarget(actor, { kind: 'unit', id: doc.unitId });
      return false;
    },
  };
}

/** Production lookup backed by Prisma + the auth policy helper. Lazy db import keeps tests db-free. */
export async function createPrismaFileAccess(): Promise<FileAccess> {
  const { db } = await import('@/lib/db/client');
  const lookup: TargetLookup = {
    async leaseExists({ leaseId, organizationId, tenantId }) {
      const where = tenantId
        ? buildLeaseAccessWhere({ role: 'TENANT', organizationId, tenantId }, leaseId)
        : buildLeaseAccessWhere({ role: 'MANAGER', organizationId }, leaseId);
      if (!where) return false;
      return (await db.lease.findFirst({ where, select: { id: true } })) !== null;
    },
    async propertyExists({ propertyId, organizationId }) {
      return (
        (await db.property.findFirst({
          where: { id: propertyId, organizationId },
          select: { id: true },
        })) !== null
      );
    },
    async unitExists({ unitId, organizationId }) {
      return (
        (await db.unit.findFirst({
          where: { id: unitId, organizationId },
          select: { id: true },
        })) !== null
      );
    },
  };
  return createFileAccess(lookup);
}
