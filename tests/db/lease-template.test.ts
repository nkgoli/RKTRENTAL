import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { deleteUnusedTemplate, ensureStandardTemplate, getTemplate, saveTemplate, setPropertyTemplate } from '@/lib/lease-create/template-service';
import { contextFromDraft, createTermsSnapshot } from '@/lib/lease-create/templates';
import { emptyDraft } from '@/lib/lease-create/types';

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')('lease template persistence', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const organizationId = `template-org-${suffix}`;
  const propertyId = `template-property-${suffix}`;
  const unitId = `template-unit-${suffix}`;
  let templateId = '';

  beforeAll(async () => {
    await prisma.organization.create({ data: { id: organizationId, name: 'Template test' } });
    await prisma.property.create({ data: { id: propertyId, organizationId, name: 'Test home',
      type: 'SINGLE_UNIT', street: '1 Test St', city: 'Austin', state: 'TX', postalCode: '78701', yearBuilt: 1970 } });
    await prisma.unit.create({ data: { id: unitId, organizationId, propertyId, number: 'Home' } });
  });
  afterAll(async () => {
    await prisma.lease.deleteMany({ where: { organizationId } });
    await prisma.property.updateMany({ where: { organizationId }, data: { defaultLeaseTemplateId: null } });
    await prisma.unit.deleteMany({ where: { organizationId } });
    await prisma.property.deleteMany({ where: { organizationId } });
    await prisma.leaseTemplate.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it('seeds the default, bumps versions, enforces usage, and preserves the sent snapshot', async () => {
    const standard = await ensureStandardTemplate(organizationId, prisma);
    templateId = standard.id;
    const property = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(property.defaultLeaseTemplateId).toBe(standard.id);
    const draft = emptyDraft({ template: standard, propertyType: 'SINGLE_UNIT', yearBuilt: 1970 });
    const snapshot = createTermsSnapshot(standard, contextFromDraft(draft), { deposit: { body: 'Exact agreed wording.' } });
    const lease = await prisma.lease.create({ data: { organizationId, unitId,
      startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31'), monthlyRent: 1500, deposit: 1500,
      templateId, templateVersion: standard.version, termsSnapshot: snapshot } });
    const updated = await saveTemplate(organizationId, { id: templateId, name: standard.name,
      items: standard.items.map((item) => ({ ...item, body: item.id.endsWith('deposit') ? 'New wording.' : item.body })),
      defaultFees: standard.defaultFees }, prisma);
    expect(updated.version).toBe(2);
    const revised = await getTemplate(organizationId, templateId, prisma);
    expect(revised?.items.find((item) => item.title === 'Security deposit')?.body).toBe('New wording.');
    expect(revised?.items.find((item) => item.title === 'Security deposit')?.id)
      .toBe(standard.items.find((item) => item.title === 'Security deposit')?.id);
    const unchanged = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    expect(unchanged.templateVersion).toBe(1);
    expect(JSON.stringify(unchanged.termsSnapshot)).toContain('Exact agreed wording.');
    expect(JSON.stringify(unchanged.termsSnapshot)).not.toContain('New wording.');
    await expect(deleteUnusedTemplate(organizationId, templateId, prisma)).rejects.toThrow('Remove this template');
    const copy = await saveTemplate(organizationId, { name: 'Copy', items: standard.items,
      defaultFees: standard.defaultFees }, prisma);
    await setPropertyTemplate(organizationId, propertyId, copy.id, prisma);
    await expect(deleteUnusedTemplate(organizationId, copy.id, prisma)).rejects.toThrow('Remove this template');
    await setPropertyTemplate(organizationId, propertyId, templateId, prisma);
    await deleteUnusedTemplate(organizationId, copy.id, prisma);
  });
});
