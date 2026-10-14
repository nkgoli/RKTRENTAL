import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { unitLabel } from '@/lib/properties/format';
import type { FileActor } from '@/lib/storage/types';
import { clauseLabels } from '@/lib/lease-create/clauses';
import { recordLeaseEvents } from '@/lib/leases/events';
import { MockEsignProvider, getEsignProvider } from './mock';
import { isSandboxEnabled } from '@/lib/providers/sandbox';
import { buildLeasePdf, signedLeaseLines } from './pdf';
import type { EsignCallbackPayload, EsignEnvelope } from './types';
import { EsignError, envelopeIdForLease } from './types';

export const SIGNED_LEASE_NAME = 'Signed lease agreement.pdf';

async function loadLease(organizationId: string, leaseId: string, client: PrismaClient) {
  const lease = await client.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
      documents: true,
    },
  });
  if (!lease) throw new EsignError('Lease not found.');
  return lease;
}

export async function sendLeaseForSignature(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
): Promise<EsignEnvelope> {
  const lease = await loadLease(organizationId, leaseId, client);
  if (lease.eSignStatus === 'SIGNED')
    return {
      id: envelopeIdForLease(leaseId),
      provider: 'mock',
      leaseId,
      status: 'SIGNED',
      signers: [],
      sentAt: null,
      signedAt: lease.signedAt?.toISOString() ?? null,
    };
  const signers = lease.tenants.map(({ tenant }) => ({
    name: tenant.name,
    email: tenant.email ?? '',
  }));
  if (!signers.length || signers.some((s) => !s.email))
    throw new EsignError(
      'Every tenant on the lease needs an email address before it can be sent for e-signature.',
      'primaryTenantId',
    );
  const envelope = await getEsignProvider().sendForSignature({
    leaseId,
    documentName: SIGNED_LEASE_NAME,
    signers,
    summaryLines: [],
  });
  await client.lease.updateMany({
    where: { id: leaseId, organizationId },
    data: { eSignStatus: 'SENT' },
  });
  await recordLeaseEvents(
    client,
    organizationId,
    leaseId,
    lease.tenants.map(({ tenant }) => ({
      kind: 'SENT' as const,
      tenantId: tenant.id,
      message: `Sent to ${tenant.email}`,
    })),
  );
  return envelope;
}

export async function getLeaseSignStatus(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
): Promise<EsignEnvelope> {
  const lease = await loadLease(organizationId, leaseId, client);
  const stored = await getEsignProvider().getStatus(envelopeIdForLease(leaseId));
  if (stored) return stored;
  return {
    id: envelopeIdForLease(leaseId),
    provider: 'mock',
    leaseId,
    status: lease.eSignStatus,
    signers: lease.tenants.map(({ tenant }) => ({
      name: tenant.name,
      email: tenant.email ?? '',
    })),
    sentAt: null,
    signedAt: lease.signedAt?.toISOString() ?? null,
  };
}

export async function handleEsignCallback(
  organizationId: string,
  actor: FileActor,
  payload: EsignCallbackPayload,
  client: PrismaClient = db,
): Promise<EsignEnvelope> {
  const envelope = await getEsignProvider().handleCallback(payload);
  const lease = await loadLease(organizationId, envelope.leaseId, client);
  if (payload.event === 'declined') {
    await client.lease.updateMany({
      where: { id: lease.id, organizationId },
      data: { eSignStatus: 'DECLINED' },
    });
    await recordLeaseEvents(
      client,
      organizationId,
      lease.id,
      lease.tenants.map(({ tenant }) => ({ kind: 'DECLINED' as const, tenantId: tenant.id })),
    );
    return envelope;
  }
  if (payload.event !== 'signed') return envelope;
  const signedAt = envelope.signedAt ? new Date(envelope.signedAt) : new Date();
  const alreadyStored = lease.documents.some((d) => d.name === SIGNED_LEASE_NAME);
  if (!alreadyStored) {
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    const lines = signedLeaseLines({
      leaseId: lease.id,
      unitLabel: unitLabel(lease.unit.property, lease.unit),
      tenantNames: lease.tenants.map((t) => t.tenant.name),
      term: `${fmt(lease.startDate)} - ${fmt(lease.endDate)}`,
      monthlyRent: lease.monthlyRent.toString(),
      deposit: lease.deposit.toString(),
      clauses: clauseLabels(['residential-use', 'utilities']),
      signedAt,
    });
    const { createPrismaFileService } = await import('@/lib/storage/service');
    await (
      await createPrismaFileService()
    ).upload(actor, {
      target: { kind: 'lease', id: lease.id },
      fileName: SIGNED_LEASE_NAME,
      mimeType: 'application/pdf',
      kind: 'LEASE',
      body: buildLeasePdf(lines),
    });
  }
  if (lease.eSignStatus !== 'SIGNED') {
    await recordLeaseEvents(client, organizationId, lease.id, [
      ...lease.tenants.map(({ tenant }) => ({
        kind: 'SIGNED' as const,
        tenantId: tenant.id,
        createdAt: signedAt,
      })),
      { kind: 'COMPLETED' as const, message: SIGNED_LEASE_NAME, createdAt: signedAt },
    ]);
  }
  await client.lease.updateMany({
    where: { id: lease.id, organizationId },
    data: { eSignStatus: 'SIGNED', signedAt },
  });
  return { ...envelope, status: 'SIGNED', signedAt: signedAt.toISOString() };
}

/** Demo/test entry point: the mock provider reports every signer as signed. */
export async function completeMockSigning(
  organizationId: string,
  actor: FileActor,
  leaseId: string,
  client: PrismaClient = db,
): Promise<EsignEnvelope> {
  if (!isSandboxEnabled()) throw new Error('Mock signing requires ROCKETRENTAL_SANDBOX=true');
  const envelope = await new MockEsignProvider().completeSigning(leaseId);
  return handleEsignCallback(
    organizationId,
    actor,
    { envelopeId: envelope.id, event: 'signed', signedAt: envelope.signedAt ?? undefined },
    client,
  );
}
