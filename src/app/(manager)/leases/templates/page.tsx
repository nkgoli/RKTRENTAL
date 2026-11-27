import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { requireManagerRole } from '@/lib/auth/access';
import { listTemplates } from '@/lib/lease-create/template-service';
import type { TemplateSection } from '@/lib/lease-create/templates';
import { TemplateMenu } from './TemplateMenu';
import styles from './templates.module.css';

export const dynamic = 'force-dynamic';

const SECTIONS: [TemplateSection, string, string][] = [
  ['CLAUSE', 'clause', 'clauses'],
  ['RULE', 'rule', 'rules'],
  ['DISCLOSURE', 'disclosure', 'disclosures'],
];
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default async function LeaseTemplatesPage() {
  const session = await requireManagerRole();
  const { templates, properties } = await listTemplates(session.organizationId);
  const defaultsFor = (id: string) =>
    properties.filter((p) => p.defaultLeaseTemplateId === id).map((p) => p.name);
  return (
    <div className={styles.page}>
      <PageHeader
        title="Lease templates"
        meta={plural(templates.length, 'template', 'templates')}
        actions={[
          { label: 'All leases', href: '/leases' },
          { label: 'Create template', href: '/leases/templates/new', primary: true, icon: 'plus' },
        ]}
      />
      {!templates.length ? (
        <section className={styles.empty}>
          <span className={styles.docIcon}>
            <Icon name="leases" />
          </span>
          <h2>No templates yet</h2>
          <Link className="btn btn-primary" href="/leases/templates/new">
            Create template
          </Link>
        </section>
      ) : (
        <ul className={styles.grid} aria-label="Lease templates">
          {templates.map((template) => {
            const defaults = defaultsFor(template.id);
            const href = `/leases/templates/${template.id}`;
            return (
              <li key={template.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.docIcon}>
                    <Icon name="leases" />
                  </span>
                  <TemplateMenu
                    template={template}
                    canDelete={!template.usageCount && !defaults.length}
                  />
                </div>
                <h2 className={styles.name}>
                  <Link href={href}>{template.name}</Link>
                </h2>
                <p className={styles.meta}>
                  <span className={styles.version}>v{template.version}</span>
                  {plural(template.usageCount, 'lease', 'leases')}
                </p>
                <ul className={styles.counts} aria-label="Contents">
                  {SECTIONS.map(([section, one, many]) => (
                    <li key={section}>
                      {plural(
                        template.items.filter((item) => item.section === section).length,
                        one,
                        many,
                      )}
                    </li>
                  ))}
                </ul>
                <div className={styles.defaults}>
                  {defaults.length ? (
                    <>
                      <span className={styles.defaultsLabel}>
                        Default for {plural(defaults.length, 'property', 'properties')}
                      </span>
                      <span className={styles.chips}>
                        {defaults.slice(0, 3).map((name) => (
                          <span key={name} className={styles.chip}>
                            {name}
                          </span>
                        ))}
                        {defaults.length > 3 && (
                          <span className={styles.chip} title={defaults.slice(3).join(', ')}>
                            +{defaults.length - 3}
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className={styles.defaultsLabel}>Not a property default</span>
                  )}
                </div>
                <Link className={`btn btn-secondary btn-sm ${styles.edit}`} href={href}>
                  Edit template
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.footnote}>Review templates with a local attorney before use.</p>
    </div>
  );
}
