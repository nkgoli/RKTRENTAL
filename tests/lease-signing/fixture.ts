/** Synthetic, retained UI fixture. Refuses any cluster outside this checkout's test directory. */
import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { hashPassword } from '../../src/lib/auth/password';
import { emptyDraft } from '../../src/lib/lease-create/types';
import { saveLeaseDraft } from '../../src/lib/lease-create/drafts';
import { createPrismaFileService } from '../../src/lib/storage/service';
import { PDFDocument } from 'pdf-lib';

async function main() {
  const client = new PrismaClient();
  try {
    const rows =
      await client.$queryRawUnsafe<Array<{ data_directory: string }>>('SHOW data_directory');
    if (
      resolve(rows[0].data_directory).toLowerCase() !==
      resolve('tests/lease-signing/node_modules/postgres').toLowerCase()
    )
      throw new Error('Not the disposable UI cluster');
    if (process.argv[2] === 'database') {
      if (
        !(
          await client.$queryRawUnsafe<unknown[]>(
            "SELECT 1 FROM pg_database WHERE datname = 'signing_ui'",
          )
        ).length
      )
        await client.$executeRawUnsafe(
          "CREATE DATABASE signing_ui WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
        );
      return;
    }
    const organizationId = 'synthetic-signing-ui';
    if (process.argv[2] === 'audit') {
      const leases = await client.lease.findMany({
        where: { organizationId },
        include: { agreements: { include: { parties: true, files: true } }, documents: true },
      });
      const result = leases.map((lease) => ({
        leaseId: lease.id,
        status: lease.status,
        agreements: lease.agreements.map((a) => ({
          id: a.id,
          version: a.version,
          archiveStatus: a.archiveStatus,
          signatures: a.parties.map((p) => ({
            role: p.role,
            name: p.expectedName,
            signed: Boolean(p.signedAt),
            consent: p.consent,
          })),
          finalPdfCount: a.files.filter((f) => f.slot === 'LEASE').length,
          addendumCount: a.files.filter((f) => f.slot !== 'LEASE').length,
        })),
        documents: lease.documents.map((d) => ({ id: d.id, name: d.name, kind: d.kind })),
      }));
      await writeFile(
        'tests/lease-signing/node_modules/audit.json',
        JSON.stringify(result, null, 2),
      );
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const renewId = process.argv[2] === 'renewal' ? process.argv[3] : undefined;
    let org = await client.organization.findUnique({ where: { id: organizationId } });
    if (!org)
      org = await client.organization.create({
        data: { id: organizationId, name: 'Synthetic Signing UI' },
      });
    const passwordHash = await hashPassword('Synthetic-signing-only-2026!');
    const user = async (key: string, role: 'OWNER' | 'TENANT' | 'MANAGER', name: string) =>
      client.user.upsert({
        where: { id: `signing-ui-${key}` },
        update: {},
        create: {
          id: `signing-ui-${key}`,
          organizationId,
          role,
          name,
          email: `signing-ui-${key}@example.test`,
          passwordHash,
        },
      });
    const manager = await user('manager', 'MANAGER', 'Synthetic Manager');
    const owner = await user('owner', 'OWNER', 'Synthetic Owner');
    await user('other-owner', 'OWNER', 'Unrelated Owner');
    const tenants = await Promise.all(
      ['one', 'two'].map(async (key) => {
        const account = await user(key, 'TENANT', `Synthetic Tenant ${key}`);
        return client.tenant.upsert({
          where: { id: `signing-ui-tenant-${key}` },
          update: {},
          create: {
            id: `signing-ui-tenant-${key}`,
            organizationId,
            userId: account.id,
            name: account.name,
            email: account.email,
          },
        });
      }),
    );
    const property = await client.property.upsert({
      where: { id: 'signing-ui-property' },
      update: {},
      create: {
        id: 'signing-ui-property',
        organizationId,
        ownerId: owner.id,
        name: 'Synthetic Elm Street',
        street: '18 Elm Street',
        city: 'Test City',
        state: 'CA',
        postalCode: '90001',
        type: 'MULTI_UNIT',
      },
    });
    const unit = await client.unit.upsert({
      where: { id: 'signing-ui-unit' },
      update: {},
      create: {
        id: 'signing-ui-unit',
        organizationId,
        propertyId: property.id,
        number: '1',
        listedRent: '1690',
      },
    });
    const draft = emptyDraft({
      unitId: unit.id,
      tenantIds: tenants.map((t) => t.id),
      primaryTenantId: tenants[0].id,
      startDate: renewId ? '2028-01-01' : '2027-01-01',
      monthlyRent: '1690',
      deposit: '1000',
      lessorName: owner.name,
      lessorEmail: owner.email,
      lessorPhone: '4155550100',
      lessorAddress: '18 Elm Street',
      customClause: 'Synthetic agreement: keep all shared exits clear.',
      customRules: 'Quiet hours begin at 10 pm.',
    });
    const saved = await saveLeaseDraft(
      organizationId,
      { draft, renewId, step: 9, nextStep: 9, strict: false },
      client,
    );
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    const files = await createPrismaFileService();
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText(renewId ? 'Synthetic renewal addendum' : 'Synthetic pet addendum');
    const addendum = await files.upload(
      { subjectId: manager.id, role: 'MANAGER', organizationId },
      {
        target: { kind: 'lease', id: saved.leaseId },
        fileName: renewId ? 'Renewal addendum.pdf' : 'Pet addendum.pdf',
        mimeType: 'application/pdf',
        kind: 'ADDENDUM',
        body: await pdf.save(),
      },
    );
    await mkdir('tests/lease-signing/node_modules', { recursive: true });
    const result = { leaseId: saved.leaseId, addendumId: addendum.id, renewId: renewId ?? null };
    await writeFile(
      `tests/lease-signing/node_modules/${renewId ? 'renewal' : 'new'}.json`,
      JSON.stringify(result),
    );
    console.log(JSON.stringify(result));
  } finally {
    await client.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
