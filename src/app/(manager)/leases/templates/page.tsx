import Link from 'next/link';
import { requireManagerRole } from '@/lib/auth/access';
import { listTemplates } from '@/lib/lease-create/template-service';

export const dynamic = 'force-dynamic';

export default async function LeaseTemplatesPage() {
  const session = await requireManagerRole();
  const { templates, properties } = await listTemplates(session.organizationId);
  return <main className="page stack">
    <header className="row between"><div><p className="eyebrow">Leases / Templates</p><h1>Lease templates</h1><p className="muted">Start each lease with wording and fees suited to its property.</p></div>
      <Link className="btn btn-primary" href="/leases/templates/new">Create template</Link></header>
    <p className="muted">Review templates with a local attorney before use.</p>
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th>Template</th><th>Version</th><th>Used by</th><th>Property defaults</th><th /></tr></thead><tbody>
      {templates.map((template) => <tr key={template.id}>
        <td><strong>{template.name}</strong></td><td>v{template.version}</td><td>{template.usageCount} leases</td>
        <td>{properties.filter((p) => p.defaultLeaseTemplateId === template.id).map((p) => p.name).join(', ') || '—'}</td>
        <td><Link href={`/leases/templates/${template.id}`}>Edit template</Link></td>
      </tr>)}
    </tbody></table></div>
  </main>;
}
