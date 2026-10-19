import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireManagerRole } from '@/lib/auth/access';
import { listTemplates } from '@/lib/lease-create/template-service';
import styles from '../leases-ux.module.css';

export const dynamic = 'force-dynamic';

export default async function LeaseTemplatesPage() {
  const session = await requireManagerRole();
  const { templates, properties } = await listTemplates(session.organizationId);
  return (
    <>
      <PageHeader
        eyebrow="Leases"
        title="Lease templates"
        actions={[
          { label: 'All leases', href: '/leases' },
          { label: 'Create template', href: '/leases/templates/new', primary: true },
        ]}
      />
      <p className="muted">
        Start each lease with wording and fees suited to its property. Review templates with a local
        attorney before use.
      </p>
      <div
        className={`card flush ${styles.scroll}`}
        role="region"
        aria-label="Lease templates"
        tabIndex={0}
      >
        <table className="table">
          <caption className={styles.caption}>
            Template changes apply to future drafts. Sent and signed wording stays with each lease.
          </caption>
          <thead>
            <tr>
              <th scope="col">Template</th>
              <th scope="col">Version</th>
              <th scope="col" className="num">
                Used by
              </th>
              <th scope="col">Property defaults</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!templates.length && (
              <tr>
                <td colSpan={5}>
                  No templates yet. Create a template to reuse wording and fees across your
                  properties.
                </td>
              </tr>
            )}
            {templates.map((template) => (
              <tr key={template.id}>
                <td>
                  <strong>{template.name}</strong>
                </td>
                <td>v{template.version}</td>
                <td className="num">{template.usageCount} leases</td>
                <td className="muted">
                  {properties
                    .filter((p) => p.defaultLeaseTemplateId === template.id)
                    .map((p) => p.name)
                    .join(', ') || '—'}
                </td>
                <td className="num">
                  <Link href={`/leases/templates/${template.id}`}>Edit template</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
