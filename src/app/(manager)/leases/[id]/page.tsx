import { SigningPanel } from '@/components/lease-signing/SigningPanel';
import { SendAgreementButton } from '@/components/lease-signing/SendAgreementButton';
import { DeleteDraftButton } from '@/components/lease-create/DeleteDraftButton';
import { draftRenewalSources } from '@/lib/lease-create/delete-draft';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import type { ReactNode } from 'react';
import { workspaceTabHref } from '@/components/workspace/routes';
import { Action, ActionGlyph, Alert, Avatar, Badge } from '@/components/ui';
import { Icon } from '@/components/shell/Icons';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { LeaseDocumentGrid } from './LeaseDocumentGrid';
import { LeaseSectionNavigation } from './LeaseSectionNavigation';
import { leaseResult, leaseResultMessages } from './feedback';
import styles from './lease-detail.module.css';
import { dateInput } from '@/lib/leases/core';
import { EVENT_LABEL } from '@/lib/leases/events';
import { money, signLabel, statusLabel, term } from '@/lib/leases/format';
import { leasesDb } from '@/lib/leases/queries';
import { formatAddress, formatDate, initials } from '@/lib/properties/format';
import { EditTermsForm, LeaseStatusActions, NoticeForm } from '../LeaseForms';
import type { TemplateItem } from '@/lib/lease-create/templates';
import { RentLedger, RentLedgerRows } from '@/components/payments/RentLedger';
import { toLastPayment, toLedgerRows } from '@/components/payments/ledger-view';
import { ensureRentCharges, formatMoney, leaseLedger, periodLabel } from '@/lib/ledger';

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
  searchParams: Promise<{ propertyId?: string; unitId?: string; tab?: string; saved?: string }>;
}) {
  const session = await requireManagerRole();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // The property Payments tab runs the same catch-up, so both read identical stored rent charges.
  if (!query.tab || query.tab === 'overview' || query.tab === 'payments')
    await ensureRentCharges(session.organizationId, new Date());
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
  // The same statement the property and unit Payments tabs show for this lease.
  const ledger = leaseLedger(lease, new Date());
  const lastPayment = toLastPayment(ledger.lastPayment);
  const ledgerRows = toLedgerRows(ledger.rows);
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
  const noticeGiven = lease.noticeGivenAt != null;
  // The server re-checks every rule (and locks) on delete; this only decides whether to offer it.
  const deletable =
    lease.status === 'DRAFT' &&
    lease.eSignStatus === 'NOT_SENT' &&
    !lease.signedAt &&
    !lease.charges.length &&
    !lease.payments.length;
  const renewal = deletable
    ? (await draftRenewalSources(session.organizationId, [lease.id])).has(lease.id)
    : false;

  const activeTab = LEASE_TABS.find((tab) => tab.key === query.tab)?.key ?? 'overview';
  // Derive scope from the authorized lease, never from caller-supplied IDs.
  const scoped = Boolean(query.propertyId || query.unitId);
  const returnScope = query.unitId ? 'unit' : scoped ? 'property' : undefined;
  const saved = leaseResult(query.saved);
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
  const signState =
    lease.eSignStatus === 'SIGNED'
      ? 'done'
      : lease.eSignStatus === 'SENT' || lease.eSignStatus === 'PARTIALLY_SIGNED'
        ? 'pending'
        : 'attention';
  const signHeadline =
    lease.eSignStatus === 'SIGNED'
      ? `Signed${lease.signedAt ? ` ${formatDate(lease.signedAt)}` : ''}`
      : lease.eSignStatus === 'NOT_SENT'
        ? 'Agreement not sent for signature'
        : lease.eSignStatus === 'DECLINED'
          ? 'Signature declined'
          : signLabel(lease.eSignStatus);
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
        <a className={styles.backLink} href={backHref}>
          <ActionGlyph name="arrow-left" />
          {scoped ? `${property.name} leases` : 'All leases'}
        </a>
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
          <span className={styles.metaItem}>
            <ActionGlyph name="tenants" />
            {lease.tenants.length
              ? lease.tenants.map(({ tenant }, index) => (
                  <span key={tenant.id}>
                    {index > 0 && ', '}
                    <a href={`/tenants/${tenant.id}`}>{tenant.name}</a>
                  </span>
                ))
              : 'No tenants yet'}
          </span>
          <span className={styles.metaItem}>
            <ActionGlyph name="payments" />
            Online payments {onlinePaymentsEnabled ? 'enabled' : 'not connected'}
          </span>
          {deletable && (
            <span className={styles.summaryAction}>
              <DeleteDraftButton
                leaseId={lease.id}
                placeLabel={title}
                tenantName={lease.tenants.map(({ tenant }) => tenant.name).join(', ') || undefined}
                renewal={renewal}
                fileCount={lease.documents.length}
                returnTo={returnScope ?? 'leases'}
              />
            </span>
          )}
        </section>

        {/* One-line signing context; the Agreement tab holds the full signer panel. */}
        <section className={styles.signing} data-state={signState} aria-label="Agreement signing">
          <span className={styles.signingStatus}>
            <ActionGlyph name={lease.eSignStatus === 'SIGNED' ? 'check' : 'signature'} />
            <strong>{signHeadline}</strong>
          </span>
          <span className="action-group">
            {activeTab !== 'agreement' && (
              <Action
                icon="leases"
                text={signState === 'done' ? 'Agreement' : 'Review signatures'}
                label="Review agreement & signatures"
                // Drafts already lead with "Continue in lease wizard"; keep one primary step.
                tone={signState === 'done' || lease.status === 'DRAFT' ? 'quiet' : 'primary'}
                href={tabHref('agreement')}
                document
              />
            )}
            <Action
              icon="external"
              text="Signing page"
              label="Open owner / lessor signing page"
              href={`/sign/leases/${lease.id}`}
              document
            />
          </span>
        </section>
        {/* Document links avoid the reproduced stalled client section transition. */}
        <LeaseSectionNavigation activeTab={activeTab} className={styles.tabs}>
          {LEASE_TABS.map((tab) => (
            <a
              key={tab.key}
              href={tabHref(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </a>
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
                    action={
                      <Action
                        icon="arrow-right"
                        trailing
                        text="Property"
                        label="View property"
                        href={`/properties/${property.id}`}
                      />
                    }
                  />
                  <div className={styles.premises}>
                    <span className={styles.building} aria-hidden="true">
                      <Icon name="properties" />
                    </span>
                    <div>
                      <h3>
                        <a href={`/properties/${property.id}`}>{property.name}</a>
                        {!lease.unit.isImplicit && (
                          <>
                            {' '}
                            ·{' '}
                            <a href={`/properties/${property.id}/units/${lease.unitId}`}>
                              Unit {lease.unit.number}
                            </a>
                          </>
                        )}
                      </h3>
                      <p className="muted">
                        {formatAddress(property)} ·{' '}
                        {lease.unit.isImplicit
                          ? 'Whole property'
                          : `Unit ${lease.unit.number} only`}
                      </p>
                    </div>
                  </div>
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
                    <a key={tenant.id} className="list-item" href={`/tenants/${tenant.id}`}>
                      <Avatar initials={initials(tenant.name)} />
                      <span className="file-meta">
                        <strong>{tenant.name}</strong>
                        <small>
                          {isPrimary ? 'Primary tenant' : 'Tenant'} · {tenant.email ?? 'No email'}
                        </small>
                      </span>
                      <ActionGlyph name="chevron-right" />
                    </a>
                  ))}
                </section>
                <section className={styles.section}>
                  <SectionHeader
                    title="Notice & move-out"
                    action={
                      <Action
                        icon="arrow-right"
                        trailing
                        text="Manage agreement"
                        label="Manage agreement"
                        href={tabHref('agreement')}
                        document
                      />
                    }
                  />
                  <dl className={styles.compactFacts}>
                    {/* Signature status lives in the signing bar above the tabs. */}
                    <dt>Notice</dt>
                    <dd>{noticeGiven ? formatDate(lease.noticeGivenAt!) : 'No notice given'}</dd>
                    <dt>Move-out</dt>
                    <dd>{lease.moveOutDate ? formatDate(lease.moveOutDate) : 'Not scheduled'}</dd>
                  </dl>
                </section>
                <section className={styles.section}>
                  <SectionHeader
                    title="Rent summary"
                    action={
                      <Action
                        icon="arrow-right"
                        trailing
                        text="View rent ledger"
                        label="View rent ledger"
                        href={tabHref('payments')}
                        document
                      />
                    }
                  />
                  <dl className={styles.compactFacts}>
                    <dt>{ledger.balanceCents < 0 ? 'Credit on account' : 'Balance due'}</dt>
                    <dd>{formatMoney(Math.abs(ledger.balanceCents))}</dd>
                    <dt>Last payment</dt>
                    <dd>{lastPayment ? lastPayment.dateLabel : 'None yet'}</dd>
                  </dl>
                  <a className={styles.secondaryLink} href={tabHref('documents')}>
                    <ActionGlyph name="documents" />
                    Lease documents ({lease.documents.length})
                  </a>
                </section>
              </div>
            </>
          )}
          {activeTab === 'agreement' && (
            <>
              {lease.eSignStatus !== 'NOT_SENT' && (
                <details>
                  <summary>Prepare current signing version</summary>
                  <SendAgreementButton leaseId={lease.id} />
                </details>
              )}
              {lease.eSignStatus === 'NOT_SENT' ? (
                <SendAgreementButton leaseId={lease.id} />
              ) : (
                <SigningPanel leaseId={lease.id} documentsHref={tabHref('documents')} />
              )}

              {(saved === 'activated' || saved === 'terminated') && (
                <Alert tone="success">{leaseResultMessages[saved]}</Alert>
              )}
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
                  <details className={styles.editTerms} open={saved === 'terms'}>
                    <summary>Edit terms</summary>
                    <EditTermsForm
                      leaseId={lease.id}
                      values={terms}
                      returnScope={returnScope}
                      saved={saved === 'terms'}
                    />
                  </details>
                )}
              </section>
              {signedTerms && (
                <section className={styles.section} aria-labelledby="terms-as-signed">
                  <div className={styles.sectionHeading}>
                    <h2 id="terms-as-signed">Prepared lease terms</h2>
                    <Badge tone="info">Saved terms</Badge>
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
                  <details className={styles.editTerms} open={saved === 'notice'}>
                    <summary>
                      {noticeGiven ? 'Update notice or move-out' : 'Record notice or move-out'}
                    </summary>
                    <NoticeForm
                      leaseId={lease.id}
                      noticeGivenAt={lease.noticeGivenAt ? dateInput(lease.noticeGivenAt) : ''}
                      moveOutDate={lease.moveOutDate ? dateInput(lease.moveOutDate) : ''}
                      returnScope={returnScope}
                      saved={saved === 'notice'}
                    />
                  </details>
                )}
              </section>
              {(lease.status === 'ACTIVE' || lease.status === 'DRAFT') && (
                <section className={styles.section}>
                  <SectionHeader title="Lease actions" />
                  <LeaseStatusActions
                    placeLabel={title}
                    leaseId={lease.id}
                    status={lease.status}
                    returnScope={returnScope}
                  />
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
              <LeaseDocumentGrid
                leaseId={lease.id}
                withUploader
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
            <RentLedger
              scope={[
                'This lease only',
                lease.unit.isImplicit ? 'Whole property' : lease.unit.number,
                periodLabel({ start: lease.startDate, end: lease.endDate }, ledger.rows),
                lease.status === 'ACTIVE' ? '' : statusLabel(lease.status),
              ]
                .filter(Boolean)
                .join(' · ')}
              balanceCents={ledger.balanceCents}
              lastPayment={lastPayment}
              actions={
                <span className="action-group">
                  {lease.status === 'ACTIVE' && (
                    <Action
                      icon="payments"
                      text="Record payment"
                      label="Record payment"
                      tone="secondary"
                      href={`${paymentsHref}${paymentsHref.includes('?') ? '&' : '?'}record=1`}
                      document
                    />
                  )}
                  <Action
                    icon="arrow-right"
                    trailing
                    text={lease.unit.isImplicit ? 'Property payments' : 'Unit payments'}
                    label={`Open ${lease.unit.isImplicit ? 'property' : 'unit'} Payments to create charges and send reminders`}
                    href={paymentsHref}
                    document
                  />
                </span>
              }
            >
              <RentLedgerRows
                groups={[
                  {
                    id: lease.id,
                    heading: title,
                    meta: '',
                    balanceCents: ledger.balanceCents,
                    active: lease.status === 'ACTIVE',
                    rows: ledgerRows,
                  },
                ]}
                groupHeadings={false}
              />
            </RentLedger>
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
                <Action
                  icon="signature"
                  text="Signature status"
                  label="See each party's current signature status"
                  tone="secondary"
                  href={tabHref('agreement')}
                  document
                />
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
