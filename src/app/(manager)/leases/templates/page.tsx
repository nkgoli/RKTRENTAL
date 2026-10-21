import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { requireManagerRole } from '@/lib/auth/access';
import { listTemplates } from '@/lib/lease-create/template-service';
import styles from './templates.module.css';
import { TemplateIcon } from './TemplateIcons';

export const dynamic = 'force-dynamic';

export default async function LeaseTemplatesPage() {
  const session = await requireManagerRole();
  const { templates, properties } = await listTemplates(session.organizationId);
  const defaults = (id: string) =>
    properties
      .filter((p) => p.defaultLeaseTemplateId === id)
      .map((p) => p.name)
      .join(', ');
  const editLink = (id: string) => (
    <Link className={`btn ${styles['lt-edit-link']}`} href={`/leases/templates/${id}`}>
      Edit template <TemplateIcon name="arrow" />
    </Link>
  );
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Workspace / Leasing"
        title="Lease templates"
        actions={[
          { label: 'All leases', href: '/leases' },
          { label: 'Create template', href: '/leases/templates/new', primary: true },
        ]}
      />
      <p className={styles['lt-intro']}>
        Start each lease with wording and fees suited to its property. Review templates with a local
        attorney before use.
      </p>
      <section className={styles['lt-band']} aria-label="How template updates work">
        <span className={styles['lt-band-icon']}>
          <Icon name="leases" />
        </span>
        <div>
          <h2>Reusable rental agreement terms</h2>
          <p>
            Template changes apply to future drafts.
            <br />
            Sent and signed wording stays with each lease.
          </p>
        </div>
        <span className={styles['lt-count']}>
          {templates.length} {templates.length === 1 ? 'template' : 'templates'}
        </span>
      </section>
      {!templates.length ? (
        <section className={`${styles['lt-panel']} ${styles['lt-state-card']}`}>
          <h2>No templates yet</h2>
          <p>Create a template to reuse wording and fees across your properties.</p>
          <Link className="btn btn-primary" href="/leases/templates/new">
            Create template
          </Link>
        </section>
      ) : (
        <>
          <section className={styles['lt-table-card']}>
            <div className={styles['lt-table-title']}>
              <h2>Your templates</h2>
            </div>
            <table>
              <caption className={styles['lt-sr']}>
                Lease templates, versions and property defaults.
              </caption>
              <thead>
                <tr>
                  {['Template', 'Version', 'Property defaults', 'Actions'].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <th scope="row">
                      <div className={styles['lt-template-name']}>
                        <span className={styles['lt-doc-icon']}>
                          <Icon name="leases" />
                        </span>
                        <strong>{template.name}</strong>
                      </div>
                    </th>
                    <td>
                      <span className={styles['lt-badge']}>v{template.version}</span>
                    </td>
                    <td className={styles['lt-defaults']}>{defaults(template.id) || '—'}</td>
                    <td>{editLink(template.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className={styles['lt-mobile-list']} aria-label="Lease templates">
            {templates.map((template) => (
              <article key={template.id} className={styles['lt-library-card']}>
                <div className={styles['lt-card-heading']}>
                  <span className={styles['lt-doc-icon']}>
                    <Icon name="leases" />
                  </span>
                  <h2>{template.name}</h2>
                  <span className={styles['lt-badge']}>v{template.version}</span>
                </div>
                <dl>
                  <div>
                    <dt>Property defaults</dt>
                    <dd>{defaults(template.id) || 'None'}</dd>
                  </div>
                </dl>
                {editLink(template.id)}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
