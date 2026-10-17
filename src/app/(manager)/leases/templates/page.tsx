import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireManagerRole } from '@/lib/auth/access';
import { listTemplates } from '@/lib/lease-create/template-service';

export const dynamic = 'force-dynamic';

export default async function LeaseTemplatesPage() {
  const session = await requireManagerRole();
  const { templates, properties } = await listTemplates(session.organizationId);
  return <>
    <PageHeader
      eyebrow="Leases"
      title="Lease templates"
      actions={[{ label: 'Create template', href: '/leases/templates/new', primary: true }]}
    />
    <p className="muted">Start each lease with wording and fees suited to its property. Review templates with a local attorney before use.</p>
    <div className="card flush">
      <table className="table">
        <thead><tr><th>Template</th><th>Version</th><th className="num">Used by</th><th>Property defaults</th><th /></tr></thead>
        <tbody>
          {templates.map((template) => <tr key={template.id}>
            <td><strong>{template.name}</strong></td>
            <td>v{template.version}</td>
            <td className="num">{template.usageCount} leases</td>
            <td className="muted">{properties.filter((p) => p.defaultLeaseTemplateId === template.id).map((p) => p.name).join(', ') || '—'}</td>
            <td className="num"><Link href={`/leases/templates/${template.id}`}>Edit template</Link></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </>;
}
