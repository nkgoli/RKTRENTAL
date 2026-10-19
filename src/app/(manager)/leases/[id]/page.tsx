import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import type { ReactNode } from 'react';
import { workspaceTabHref } from '@/components/workspace/routes';
import { Avatar, Badge } from '@/components/ui';
import { Icon } from '@/components/shell/Icons';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { LeaseDocumentGrid } from './LeaseDocumentGrid';
import { LeaseSectionNavigation } from './LeaseSectionNavigation';
import styles from './lease-detail.module.css';
import { dateInput } from '@/lib/leases/core';
import { EVENT_LABEL } from '@/lib/leases/events';
import { money, signLabel, statusLabel, term } from '@/lib/leases/format';
import { leasesDb } from '@/lib/leases/queries';
import { formatAddress, formatDate, initials } from '@/lib/properties/format';
import { EditTermsForm, LeaseStatusActions, LeaseUploader, NoticeForm } from '../LeaseForms';
import type { TemplateItem } from '@/lib/lease-create/templates';

const CHARGE_LABEL: Record<string, string> = {
  RENT: 'Rent',
  DEPOSIT: 'Deposit',
  LATE_FEE: 'Late fee',
  OTHER: 'Fee',
};

const showSignedBody = (body: string) =>
  body
    .split(/(\{\{[a-z_]+\}\})/g)
    .map((part, index) =>
      /^\{\{[a-z_]+\}\}$/.test(part) ? (
        <mark key={index}>________ ({part.slice(2, -2).replaceAll('_', ' ')})</mark>
      ) : (
        part
      ),
    );

const LEASE_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'agreement', label: 'Agreement' },
  { key: 'documents', label: 'Documents' },
  { key: 'payments', label: 'Payments' },
  { key: 'activity', label: 'Activity' },
] as const;

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ propertyId?: string; unitId?: string; tab?: string }>;
}) {
  const session = await requireManagerRole();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const lease = await leasesDb(session.organizationId).detail(id);
  if (!lease) notFound();
  const property = lease.unit.property;
  const signedTerms =
    lease.termsSnapshot &&
    typeof lease.termsSnapshot === 'object' &&
    !Array.isArray(lease.termsSnapshot)
      ? (lease.termsSnapshot as Record<string, unknown>)
      : null;
  const snapshotItems = Array.isArray(signedTerms?.items)
    ? (signedTerms.items as TemplateItem[])
    : [];
  const snapshotTemplate =
    signedTerms?.template && typeof signedTerms.template === 'object'
      ? (signedTerms.template as { name?: string })
      : null;
  const title = property.name + (lease.unit.isImplicit ? '' : ' · Unit ' + lease.unit.number);
  const onlinePaymentsEnabled =
    (await db.providerConnection.count({
      where: { organizationId: session.organizationId, kind: 'PAYMENTS', status: 'CONNECTED' },
    })) > 0;
  const charges = lease.charges.filter((c) => c.dueDate <= new Date());
  const charged = charges.reduce((sum, c) => sum + Number(c.amount), 0);
  const paid = lease.payments
    .filter((p) => p.status === 'SUCCEEDED')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, charged - paid);
  const lastPayment = lease.payments.find((p) => p.status === 'SUCCEEDED');
  const terms = {
    startDate: dateInput(lease.startDate),
    endDate: dateInput(lease.endDate),
    monthlyRent: lease.monthlyRent.toString(),
    deposit: lease.deposit.toString(),
    lateFee: lease.lateFee.toString(),
    graceDays: lease.graceDays,
  };
  const eventText = (e: (typeof lease.events)[number]) =>
    [e.tenant ? `${EVENT_LABEL[e.kind]}: ${e.tenant.name}` : EVENT_LABEL[e.kind], e.message]
      .filter(Boolean)
      .join(' · ');
  const activities = [
    ...lease.documents.map((d) => ({ date: d.createdAt, text: `${d.name} uploaded` })),
    ...lease.events.map((e) => ({ date: e.createdAt, text: eventText(e) })),
    ...(lease.events.length
      ? []
      : [
          ...(lease.signedAt ? [{ date: lease.signedAt, text: 'Lease marked fully signed' }] : []),
          { date: lease.createdAt, text: 'Lease created' },
        ]),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const signerStatus = lease.tenants.map(({ tenant }) => {
    const latest = lease.events.find(
      (e) => e.tenantId === tenant.id && ['SENT', 'SIGNED', 'DECLINED'].includes(e.kind),
    );
    return { tenant, event: latest };
  });
  const noticeGiven = lease.noticeGivenAt != null;
  // A lease marked signed without per-signer events was signed outside the e-sign flow.
  const signedOnPaper = lease.eSignStatus === 'SIGNED';

  const activeTab = LEASE_TABS.find((tab) => tab.key === query.tab)?.key ?? 'overview';
  // Derive scope from the authorized lease, never from caller-supplied IDs.
  const scoped = Boolean(query.propertyId || query.unitId);
  const backHref = scoped
    ? workspaceTabHref(property.id, 'leases', query.unitId ? lease.unitId : undefined)
    : '/leases';
  const paymentsHref = workspaceTabHref(property.id, 'payments', lease.unitId);
  const tabHref = (tab: string) => {
    const search = new URLSearchParams();
    if (scoped) search.set('propertyId', property.id);
    if (query.unitId) search.set('unitId', lease.unitId);
    if (tab !== 'overview') search.set('tab', tab);
    return `/leases/${lease.id}${search.size ? `?${search}` : ''}`;
  };
  const dueDay = `${lease.rentDueDay}${[1, 21].includes(lease.rentDueDay) ? 'st' : [2, 22].includes(lease.rentDueDay) ? 'nd' : [3, 23].includes(lease.rentDueDay) ? 'rd' : 'th'}`;
  return (
    <>
      <PageHeader
        title={title}
        eyebrow="Lease"
        actions={[
          ...(lease.status === 'DRAFT'
            ? [
                {
                  label: 'Continue in lease wizard',
                  href: `/leases/new?draft=${lease.id}`,
                  primary: true,
                },
              ]
            : []),
          ...(lease.status === 'ACTIVE'
            ? [{ label: 'Renew lease', href: `/leases/new?renew=${lease.id}`, primary: true }]
            : []),
        ]}
      />

      <div className={styles.workspace}>
        <Link className={styles.backLink} href={backHref}>
          ← {scoped ? `${property.name} leases` : 'All leases'}
        </Link>
        <section className={styles.summaryLine} aria-label="Lease summary">
          <Badge
            tone={
              lease.status === 'ACTIVE' ? 'success' : lease.status === 'DRAFT' ? 'info' : 'neutral'
            }
          >
            {statusLabel(lease.status)}
          </Badge>
          {lease.status === 'ACTIVE' &&
            lease.endDate >= new Date() &&
            lease.endDate <= new Date(Date.now() + 60 * 86_400_000) && (
              <Badge tone="warning">Expiring soon · {formatDate(lease.endDate)}</Badge>
            )}
          {noticeGiven && (
            <Badge tone="warning">Notice given {formatDate(lease.noticeGivenAt!)}</Badge>
          )}
          <span>
            {lease.tenants.length
              ? lease.tenants.map(({ tenant }, index) => (
                  <span key={tenant.id}>
                    {index > 0 && ', '}
                    <Link href={`/tenants/${tenant.id}`}>{tenant.name}</Link>
                  </span>
                ))
              : 'No tenants yet'}
          </span>
          <span className="muted">· {signLabel(lease.eSignStatus)}</span>
          <span className="muted">
            · Online payments {onlinePaymentsEnabled ? 'enabled' : 'not connected'}
          </span>
        </section>

        <LeaseSectionNavigation activeTab={activeTab} className={styles.tabs}>
          {LEASE_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tabHref(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              scroll={false}
            >
              {tab.label}
            </Link>
          ))}
        </LeaseSectionNavigation>
        <div className={styles.panel} id={`lease-${activeTab}`}>
          {activeTab === 'overview' && (
            <>
              <dl className={styles.facts} aria-label="Key lease terms">
                <div>
                  <dt>Monthly rent</dt>
                  <dd>
                    {money(lease.monthlyRent)}
                    <small>Due on the {dueDay}</small>
                  </dd>
                </div>
                <div>
                  <dt>Start date</dt>
                  <dd>{formatDate(lease.startDate)}</dd>
                </div>
                <div>
                  <dt>End date</dt>
                  <dd>{formatDate(lease.endDate)}</dd>
                </div>
                <div>
                  <dt>Security deposit</dt>
                  <dd>{money(lease.deposit)}</dd>
                </div>
              </dl>
              <div className={styles.overviewGrid}>
                <section className={styles.section}>
                  <SectionHeader
                    title="Leased premises"
                    action={<Badge>One property · one unit</Badge>}
                  />
                  <div className={styles.premises}>
                    <span className={styles.building} aria-hidden="true">
                      <Icon name="properties" />
                    </span>
                    <div>
                      <h3>
                        <Link href={`/properties/${property.id}`}>{property.name}</Link>
                        {!lease.unit.isImplicit && (
                          <>
                            {' '}
                            ·{' '}
                            <Link href={`/properties/${property.id}/units/${lease.unitId}`}>
                              Unit {lease.unit.number}
                            </Link>
                          </>
                        )}
                      </h3>
                      <p className="muted" style={{ marginTop: 4 }}>
                        {formatAddress(property)}
                      </p>
                    </div>
                  </div>
                  <p className="muted" style={{ marginTop: 14 }}>
                    This lease covers{' '}
                    {lease.unit.isImplicit
                      ? 'the whole property'
                      : `Unit ${lease.unit.number} only`}{' '}
                    at {property.name}.
                  </p>
                  <Link className={styles.secondaryLink} href={`/properties/${property.id}`}>
                    View property <span aria-hidden="true">→</span>
                  </Link>
                </section>
                <section className={styles.section}>
                  <SectionHeader
                    title="Tenants on this lease"
                    action={
                      <Badge>
                        {lease.tenants.length} {lease.tenants.length === 1 ? 'tenant' : 'tenants'}
                      </Badge>
                    }
                  />
                  {!lease.tenants.length && <p className="muted">No tenants yet.</p>}
                  {lease.tenants.map(({ tenant, isPrimary }) => (
                    <Link key={tenant.id} className="list-item" href={`/tenants/${tenant.id}`}>
                      <Avatar initials={initials(tenant.name)} />
                      <span className="file-meta">
                        <strong>{tenant.name}</strong>
                        <small>
                          {isPrimary ? 'Primary tenant' : 'Tenant'} · {tenant.email ?? 'No email'}
                        </small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </section>
                <section className={styles.section}>
                  <SectionHeader
                    title="Agreement & move-out"
                    action={<Link href={tabHref('agreement')}>Manage agreement →</Link>}
                  />
                  <dl className={styles.compactFacts}>
                    <dt>Signature</dt>
                    <dd>
                      {signLabel(lease.eSignStatus)}
                      {lease.signedAt && ` · ${formatDate(lease.signedAt)}`}
                    </dd>
                    <dt>Notice</dt>
                    <dd>{noticeGiven ? formatDate(lease.noticeGivenAt!) : 'No notice given'}</dd>
                    <dt>Move-out</dt>
                    <dd>{lease.moveOutDate ? formatDate(lease.moveOutDate) : 'Not scheduled'}</dd>
                  </dl>
                </section>
                <section className={styles.section}>
                  <SectionHeader
                    title="Rent summary"
                    action={<Link href={tabHref('payments')}>View rent ledger →</Link>}
                  />
                  <dl className={styles.compactFacts}>
                    <dt>Balance due</dt>
                    <dd>{money(balance)}</dd>
                    <dt>Last payment</dt>
                    <dd>
                      {lastPayment
                        ? formatDate(lastPayment.paidAt ?? lastPayment.createdAt)
                        : 'None yet'}
                    </dd>
                  </dl>
                  <Link className={styles.secondaryLink} href={tabHref('documents')}>
                    Lease documents ({lease.documents.length}) →
                  </Link>
                </section>
              </div>
            </>
          )}
          {activeTab === 'agreement' && (
            <>
              <section className={styles.section}>
                <SectionHeader title="Lease terms" />
                <dl className="kv">
                  <dt>Lease term</dt>
                  <dd>{term(lease.startDate, lease.endDate)}</dd>
                  <dt>Monthly rent</dt>
                  <dd>
                    {money(lease.monthlyRent)} · due on the {dueDay}
                  </dd>
                  <dt>Security deposit</dt>
                  <dd>{money(lease.deposit)}</dd>
                  <dt>Late fee</dt>
                  <dd>
                    {money(lease.lateFee)} after a {lease.graceDays}-day grace period
                  </dd>
                  <dt>Occupants</dt>
                  <dd>{lease.occupants ?? '—'}</dd>
                </dl>
                {(lease.status === 'ACTIVE' || lease.status === 'DRAFT') && (
                  // The form repeats every value above, so it stays folded until asked for.
                  <details className={styles.editTerms}>
                    <summary>Edit terms</summary>
                    <EditTermsForm leaseId={lease.id} values={terms} />
                  </details>
                )}
              </section>
              {signedTerms && (
                <section className={styles.section} aria-labelledby="terms-as-signed">
                  <div className={styles.sectionHeading}>
                    <h2 id="terms-as-signed">Terms as signed</h2>
                    <Badge tone="info">Locked at send</Badge>
                  </div>
                  <p className="muted">
                    {snapshotTemplate?.name ?? 'Lease template'} · v{lease.templateVersion ?? 1}
                    {lease.signedAt
                      ? ` · Signed ${formatDate(lease.signedAt)}`
                      : ' · Sent for signature'}
                  </p>
                  <details className={styles.signedDetails}>
                    <summary>
                      Show all {snapshotItems.length} clauses, rules and disclosures
                    </summary>
                    <div className={styles.signedGrid}>
                      {snapshotItems.map((item) => (
                        <article key={item.id}>
                          <h3>
                            {item.section === 'CLAUSE'
                              ? 'Clause'
                              : item.section === 'RULE'
                                ? 'Rule'
                                : 'Disclosure'}{' '}
                            · {item.title}
                          </h3>
                          <p>{showSignedBody(item.body)}</p>
                        </article>
                      ))}
                    </div>
                  </details>
                  <p className="muted">
                    These words and the template version remain on this lease when a template
                    changes.
                  </p>
                </section>
              )}
              {!signedTerms && (
                <section className={styles.section}>
                  <SectionHeader title="Terms as signed" />
                  <p className="muted">
                    No agreement snapshot is recorded for this lease. Check Documents for an
                    uploaded signed agreement.
                  </p>
                  <Link href={tabHref('documents')}>View lease documents →</Link>
                </section>
              )}

              <section
                className={`${styles.section} ${styles.amendment}`}
                aria-label="Amendment or addendum"
              >
                <div>
                  <h2>Add an amendment or addendum</h2>
                  <p className="muted">Keep every lease change documented and easy to share.</p>
                </div>
                <Link className="btn btn-secondary btn-sm" href="/leases/templates">
                  Browse templates
                </Link>
              </section>
              <section className={styles.section}>
                <SectionHeader title="Notice & move-out" />
                <dl className={styles.compactFacts}>
                  <dt>Notice given</dt>
                  <dd>{noticeGiven ? formatDate(lease.noticeGivenAt!) : 'No notice given'}</dd>
                  <dt>Planned move-out</dt>
                  <dd>{lease.moveOutDate ? formatDate(lease.moveOutDate) : 'Not scheduled'}</dd>
                </dl>
                {lease.status === 'ACTIVE' && (
                  <details className={styles.editTerms}>
                    <summary>
                      {noticeGiven ? 'Update notice or move-out' : 'Record notice or move-out'}
                    </summary>
                    <NoticeForm
                      leaseId={lease.id}
                      noticeGivenAt={lease.noticeGivenAt ? dateInput(lease.noticeGivenAt) : ''}
                      moveOutDate={lease.moveOutDate ? dateInput(lease.moveOutDate) : ''}
                    />
                  </details>
                )}
              </section>
              {(lease.status === 'ACTIVE' || lease.status === 'DRAFT') && (
                <section className={styles.section}>
                  <SectionHeader title="Lease actions" />
                  <LeaseStatusActions leaseId={lease.id} status={lease.status} />
                </section>
              )}
            </>
          )}
          {activeTab === 'documents' && (
            <section className={styles.section} id="documents">
              <div className="card-header">
                <div>
                  <h2>Lease documents</h2>
                  <p className="muted" style={{ fontSize: 13 }}>
                    Files owned by this lease
                  </p>
                </div>
              </div>
              <LeaseUploader leaseId={lease.id} />
              <LeaseDocumentGrid
                leaseId={lease.id}
                documents={lease.documents.map((file) => ({
                  id: file.id,
                  name: file.name,
                  kind: file.kind.toLowerCase(),
                  uploaded: formatDate(file.createdAt),
                  mimeType: file.mimeType,
                }))}
              />
            </section>
          )}
          {activeTab === 'payments' && (
            <section className={styles.section}>
              <SectionHeader
                title="Rent ledger"
                action={
                  <Link className="btn btn-ghost btn-sm" href={paymentsHref}>
                    View payments →
                  </Link>
                }
              />
              <div className={styles.ledgerFacts}>
                <div>
                  <small>Balance due</small>
                  <strong>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      balance,
                    )}
                  </strong>
                </div>
                <div>
                  <small>Last payment</small>
                  <strong>
                    {lastPayment
                      ? formatDate(lastPayment.paidAt ?? lastPayment.createdAt)
                      : 'None yet'}
                  </strong>
                </div>
              </div>
              {charges.slice(0, 3).map((charge) => (
                <div className={styles.ledgerLine} key={charge.id}>
                  <Badge>{CHARGE_LABEL[charge.kind] ?? 'Charge'}</Badge>
                  <span className="file-meta">
                    <strong>{money(charge.amount)}</strong>
                    <small>Due {formatDate(charge.dueDate)}</small>
                  </span>
                </div>
              ))}
              {!charges.length && (
                <p className="muted" style={{ marginTop: 12 }}>
                  No charges due yet.
                </p>
              )}
            </section>
          )}
          {activeTab === 'activity' && (
            <div className={styles.overviewGrid}>
              <section className={styles.section}>
                <SectionHeader
                  title="E-signature history"
                  action={
                    <Badge
                      tone={
                        lease.eSignStatus === 'SIGNED'
                          ? 'success'
                          : lease.eSignStatus === 'PARTIALLY_SIGNED'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {signLabel(lease.eSignStatus)}
                    </Badge>
                  }
                />
                <p className="muted">
                  {lease.signedAt
                    ? `Fully signed ${formatDate(lease.signedAt)}`
                    : lease.eSignStatus === 'SIGNED'
                      ? 'Marked signed; signature time was not recorded.'
                      : 'No completed signature recorded yet.'}
                </p>
                {signerStatus.length > 0 && (
                  <div aria-label="Signers" style={{ marginTop: 12 }}>
                    {signerStatus.map(({ tenant, event }) => (
                      <div className="list-item" key={tenant.id}>
                        <Avatar initials={initials(tenant.name)} size="sm" />
                        <span className="file-meta">
                          <strong>{tenant.name}</strong>
                          <small>
                            {event
                              ? `${EVENT_LABEL[event.kind]} · ${formatDate(event.createdAt)}`
                              : signedOnPaper
                                ? `Signed${lease.signedAt ? ` · ${formatDate(lease.signedAt)}` : ''}`
                                : 'Not sent'}
                          </small>
                        </span>
                        <Badge
                          tone={
                            event?.kind === 'SIGNED' || (!event && signedOnPaper)
                              ? 'success'
                              : event?.kind === 'DECLINED'
                                ? 'danger'
                                : 'info'
                          }
                        >
                          {event?.kind === 'SIGNED' || (!event && signedOnPaper)
                            ? 'Signed'
                            : event?.kind === 'DECLINED'
                              ? 'Declined'
                              : event
                                ? 'Awaiting'
                                : 'Draft'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className={styles.section}>
                <SectionHeader title="Activity" />
                <ol className={styles.timeline}>
                  {activities.map((item, index) => (
                    <li className={styles.event} key={index}>
                      <span className={styles.eventDot} aria-hidden="true">
                        ↗
                      </span>
                      <span className="file-meta">
                        <strong>{item.text}</strong>
                        <small>{formatDate(item.date)}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
