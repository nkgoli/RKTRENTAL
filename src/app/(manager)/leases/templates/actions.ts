'use server';

import { requireManagerRole } from '@/lib/auth/access';
import { deleteUnusedTemplate, getTemplate, saveTemplate, setPropertyTemplate } from '@/lib/lease-create/template-service';
import type { TemplateFees, TemplateItem } from '@/lib/lease-create/templates';

export async function saveLeaseTemplateAction(input: { id?: string; name: string; items: TemplateItem[]; defaultFees: TemplateFees }) {
  const session = await requireManagerRole();
  try {
    const saved = await saveTemplate(session.organizationId, input);
    return { template: await getTemplate(session.organizationId, saved.id) };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Could not save template.' }; }
}

export async function setPropertyLeaseTemplateAction(propertyId: string, templateId: string) {
  const session = await requireManagerRole();
  try { await setPropertyTemplate(session.organizationId, propertyId, templateId); return { ok: true }; }
  catch (error) { return { error: error instanceof Error ? error.message : 'Could not set default.' }; }
}

export async function deleteLeaseTemplateAction(templateId: string) {
  const session = await requireManagerRole();
  try { await deleteUnusedTemplate(session.organizationId, templateId); return { ok: true }; }
  catch (error) { return { error: error instanceof Error ? error.message : 'Could not delete template.' }; }
}
