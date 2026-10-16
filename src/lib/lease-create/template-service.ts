import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import {
  INCLUDE_WHEN, STANDARD_FEES,
  type IncludeWhen, type TemplateDefinition, type TemplateFees, type TemplateItem,
} from './templates';
import { STANDARD_V2_ITEMS } from './standard-v2';

const include = { items: { orderBy: { sortOrder: 'asc' as const } } };
const fees = (raw: unknown): TemplateFees => {
  const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    lateFee: String(f.lateFee ?? STANDARD_FEES.lateFee),
    graceDays: Number(f.graceDays ?? STANDARD_FEES.graceDays),
    moveInFee: String(f.moveInFee ?? ''),
    petDeposit: String(f.petDeposit ?? ''),
    returnedPaymentFee: String(f.returnedPaymentFee ?? ''),
    keyFee: String(f.keyFee ?? ''),
  };
};
export function toDefinition(row: {
  id: string; name: string; version: number; defaultFees: unknown;
  items: { id: string; section: string; title: string; body: string; sortOrder: number; required: boolean; includeWhen: string }[];
}): TemplateDefinition {
  return { id: row.id, name: row.name, version: row.version, defaultFees: fees(row.defaultFees),
    items: row.items.map((i) => ({ id: i.id, section: i.section as TemplateItem['section'],
      title: i.title, body: i.body, order: i.sortOrder, required: i.required,
      includeWhen: i.includeWhen as IncludeWhen })) };
}

export async function ensureStandardTemplate(organizationId: string, client: PrismaClient = db) {
  const first = await client.leaseTemplate.findFirst({ where: { organizationId, name: 'Standard residential lease' }, include, orderBy: { createdAt: 'asc' } });
  if (first?.version === 1) {
    const upgraded = await client.$transaction(async (tx) => {
      await tx.leaseTemplateItem.deleteMany({ where: { templateId: first.id, organizationId } });
      const result = await tx.leaseTemplate.update({ where: { id: first.id }, data: {
        version: 2, defaultFees: STANDARD_FEES as unknown as Prisma.InputJsonValue,
        items: { create: STANDARD_V2_ITEMS.map((i) => ({ section: i.section, title: i.title, body: i.body,
          sortOrder: i.order, required: i.required, includeWhen: i.includeWhen })) },
      }, include });
      await tx.property.updateMany({ where: { organizationId, defaultLeaseTemplateId: null }, data: { defaultLeaseTemplateId: first.id } });
      return result;
    });
    return toDefinition(upgraded);
  }
  if (first) return toDefinition(first);
  const created = await client.leaseTemplate.create({ data: {
    organization: { connect: { id: organizationId } }, name: 'Standard residential lease', version: 2,
    defaultFees: STANDARD_FEES as unknown as Prisma.InputJsonValue,
    items: { create: STANDARD_V2_ITEMS.map((i) => ({
      section: i.section, title: i.title, body: i.body,
      sortOrder: i.order, required: i.required, includeWhen: i.includeWhen })) },
  }, include });
  await client.property.updateMany({ where: { organizationId, defaultLeaseTemplateId: null }, data: { defaultLeaseTemplateId: created.id } });
  return toDefinition(created);
}

export async function listTemplates(organizationId: string, client: PrismaClient = db) {
  await ensureStandardTemplate(organizationId, client);
  const [rows, properties] = await Promise.all([
    client.leaseTemplate.findMany({ where: { organizationId }, include: { ...include, _count: { select: { leases: true } } }, orderBy: { updatedAt: 'desc' } }),
    client.property.findMany({ where: { organizationId, archivedAt: null }, select: { id: true, name: true, defaultLeaseTemplateId: true }, orderBy: { name: 'asc' } }),
  ]);
  return { templates: rows.map((row) => ({ ...toDefinition(row), usageCount: row._count.leases })), properties };
}

export async function templateForProperty(organizationId: string, propertyId: string, client: PrismaClient = db) {
  const standard = await ensureStandardTemplate(organizationId, client);
  const property = await client.property.findFirst({ where: { id: propertyId, organizationId }, select: { defaultLeaseTemplateId: true } });
  if (!property?.defaultLeaseTemplateId) return standard;
  const row = await client.leaseTemplate.findFirst({ where: { id: property.defaultLeaseTemplateId, organizationId }, include });
  return row ? toDefinition(row) : standard;
}

export async function getTemplate(organizationId: string, id: string, client: PrismaClient = db) {
  const row = await client.leaseTemplate.findFirst({ where: { id, organizationId }, include });
  return row ? toDefinition(row) : null;
}

function validated(input: { name: string; items: TemplateItem[]; defaultFees: TemplateFees }) {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error('Enter a template name.');
  if (input.items.length > 100) throw new Error('A template can have at most 100 items.');
  const items = input.items.map((i, index) => {
    const section = ['CLAUSE', 'RULE', 'DISCLOSURE'].includes(i.section) ? i.section : 'CLAUSE';
    const includeWhen = INCLUDE_WHEN.includes(i.includeWhen) ? i.includeWhen : 'ALWAYS';
    const title = i.title.trim().slice(0, 160);
    const body = i.body.trim().slice(0, 4000);
    if (!title || !body) throw new Error('Every template item needs a title and wording.');
    return { id: i.id, section, includeWhen, title, body, required: Boolean(i.required), sortOrder: index };
  });
  const defaultFees = fees(input.defaultFees);
  if ([defaultFees.lateFee, defaultFees.moveInFee, defaultFees.petDeposit, defaultFees.returnedPaymentFee, defaultFees.keyFee].some((v) => v && (!Number.isFinite(Number(v)) || Number(v) < 0))) throw new Error('Enter valid fee amounts.');
  if (!Number.isInteger(defaultFees.graceDays) || defaultFees.graceDays < 0 || defaultFees.graceDays > 31) throw new Error('Enter 0 to 31 grace days.');
  return { name, items, defaultFees };
}

export async function saveTemplate(organizationId: string, input: { id?: string; name: string; items: TemplateItem[]; defaultFees: TemplateFees }, client: PrismaClient = db) {
  const data = validated(input);
  return client.$transaction(async (tx) => {
    if (input.id) {
      const existing = await tx.leaseTemplate.findFirst({ where: { id: input.id, organizationId }, select: { id: true, items: { select: { id: true } } } });
      if (!existing) throw new Error('Template not found.');
      const knownIds = new Set(existing.items.map((i) => i.id));
      await tx.leaseTemplateItem.deleteMany({ where: { templateId: input.id, organizationId } });
      return tx.leaseTemplate.update({ where: { id: input.id }, data: {
        name: data.name, version: { increment: 1 }, defaultFees: data.defaultFees as unknown as Prisma.InputJsonValue,
        items: { create: data.items.map((item) => ({ ...item, id: knownIds.has(item.id) ? item.id : undefined })) },
      }, select: { id: true, version: true } });
    }
    return tx.leaseTemplate.create({ data: { organization: { connect: { id: organizationId } }, name: data.name,
      defaultFees: data.defaultFees as unknown as Prisma.InputJsonValue,
      items: { create: data.items.map((item) => ({ section: item.section, includeWhen: item.includeWhen,
        title: item.title, body: item.body, required: item.required, sortOrder: item.sortOrder })) },
    }, select: { id: true, version: true } });
  });
}

export async function setPropertyTemplate(organizationId: string, propertyId: string, templateId: string, client: PrismaClient = db) {
  const template = await client.leaseTemplate.findFirst({ where: { id: templateId, organizationId }, select: { id: true } });
  if (!template) throw new Error('Template not found.');
  const result = await client.property.updateMany({ where: { id: propertyId, organizationId }, data: { defaultLeaseTemplateId: templateId } });
  if (!result.count) throw new Error('Property not found.');
}

export async function deleteUnusedTemplate(organizationId: string, templateId: string, client: PrismaClient = db) {
  const [leases, properties] = await Promise.all([
    client.lease.count({ where: { organizationId, templateId } }),
    client.property.count({ where: { organizationId, defaultLeaseTemplateId: templateId } }),
  ]);
  if (leases || properties) throw new Error('Remove this template from leases and property defaults before deleting it.');
  await client.leaseTemplate.deleteMany({ where: { id: templateId, organizationId } });
}
