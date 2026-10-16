import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { listTemplates } from '@/lib/lease-create/template-service';
import { TemplateEditor } from './TemplateEditor';

export const dynamic = 'force-dynamic';

export default async function LeaseTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagerRole();
  const { id } = await params;
  const { templates, properties } = await listTemplates(session.organizationId);
  const template = id === 'new' ? null : templates.find((t) => t.id === id);
  if (id !== 'new' && !template) notFound();
  return <TemplateEditor initial={template ?? null} properties={properties} />;
}
