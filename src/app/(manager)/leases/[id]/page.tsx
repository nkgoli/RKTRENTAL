import { SigningPanel } from '@/components/lease-signing/SigningPanel';
import { SendAgreementButton } from '@/components/lease-signing/SendAgreementButton';
import { DeleteDraftButton } from '@/components/lease-create/DeleteDraftButton';
import { draftRenewalSources } from '@/lib/lease-create/delete-draft';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import type { ReactNode } from 'react';
import { workspaceTabHref } from '@/components/workspace/routes';
import { ActionGlyph, Alert, Avatar, Badge } from '@/components/ui';
import { Icon } from '@/components/shell/Icons';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { LeaseDocumentGrid } from './LeaseDocumentGrid';
import { LeaseSectionNavigation } from './LeaseSectionNavigation';
import { leaseResult, leaseResultMessages } from './feedback';
import styles from './lease-detail.module.css';
import { dateInput } from '@/lib/leases/core';
import { EVENT_LABEL } from '@/lib/leases/events';
import { money, signLabel, term } from '@/lib/leases/format';
import { leasesDb } from '@/lib/leases/queries';
import { formatAddress, formatDate, initials } from '@/lib/properties/format';
import { EditTermsForm, LeaseStatusActions, NoticeForm } from '../LeaseForms';
import type { TemplateItem } from '@/lib/lease-create/templates';
import { RentLedger, RentLedgerRows } from '@/components/payments/RentLedger';
import {
  recentLedgerRows,
  toLastPayment,
  toLedgerRows,
  toPaymentViews,
} from '@/components/payments/ledger-view';
import { ensureRentCharges, leaseLedger, periodLabel } from '@/lib/ledger';
import { formatFileSize, lateLine, leaseStatusBadge, signatureSummary } from './lease-view';

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
  { key: 'documents', label: 'Documents', short: 'Docs' },
  { key: 'payments', label: 'Payments' },
  { key: 'activity', label: 'Activity' },
] as const;

function SectionHeader({ title, id, action }: { title: string; id?: string; action?: ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <h2 id={id}>{title}</h2>
      {action}
    </div>
  );
}

/** A quiet text link with a trailing arrow, e.g. "Payments →". */
function GoLink({ href, children, label }: { href: string; children: string; label?: string }) {
  return (
    <a className={styles.goLink} href={href} aria-label={label}>
      {children} <span aria-hidden="true">→</span>
    </a>
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
  const now = new Date();
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
  const [connectedPayments, agreement] = await Promise.all([
    db.providerConnection.count({
      where: { organizationId: session.organizationId, kind: 'PAYMENTS', status: 'CONNECTED' },
    }),
    // Read-only: the stored state of the latest signing version for the signature panel.
    db.leaseAgreement.findFirst({
      where: { organizationId: session.organizationId, leaseId: lease.id },
      orderBy: { version: 'desc' },
      include: { parties: { orderBy: { id: 'asc' } }, files: true },
    }),
  ]);
  const onlinePaymentsEnabled = connectedPayments > 0;
  // The same statement the property and unit Payments tabs show for this lease.
  const ledger = leaseLedger(lease, now);
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
  const ledgerHref = `/leases/${lease.id}/ledger`;
  const tabHref = (tab: string) => {
    const search = new URLSearchParams();
    if (scoped) search.set('propertyId', property.id);
    if (query.unitId) search.set('unitId', lease.unitId);
    if (tab !== 'overview') search.set('tab', tab);
    return `/leases/${lease.id}${search.size ? `?${search}` : ''}`;
  };
  const tenants = lease.tenants.map(({ tenant }) => ({ id: tenant.id, name: tenant.name }));
  const leaseFile = lease.documents.find((d) => d.kind === 'LEASE') ?? null;
  const signature = signatureSummary({
    eSignStatus: lease.eSignStatus,
    signedAt: lease.signedAt,
    agreement: agreement && { ...agreement, archiveError: agreement.archiveLastError },
    leaseFile: leaseFile && { id: leaseFile.id, name: leaseFile.name },
    tenants,
    formatDate,
  });
  const status = leaseStatusBadge(lease, now);
  const dueDay = `${lease.rentDueDay}${[1, 21].includes(lease.rentDueDay) ? 'st' : [2, 22].includes(lease.rentDueDay) ? 'nd' : [3, 23].includes(lease.rentDueDay) ? 'rd' : 'th'}`;
  const placeText = lease.unit.isImplicit ? 'Whole property' : `Unit ${lease.unit.number}`;
  const ledgerScope = [
    'This lease only',
    lease.unit.isImplicit ? 'Whole property' : lease.unit.number,
    periodLabel({ start: lease.startDate, end: lease.endDate }, ledger.rows),
    lease.status === 'ACTIVE' ? '' : status.label,
  ]
    .filter(Boolean)
    .join(' · ');
  const addendums = lease.documents.filter((d) => d.kind === 'ADDENDUM');
  // Late rows open this lease's reminder review; a reminder is never sent from the ledger.
  // A plain object: this server page cannot hand functions to the client ledger rows.
  const reminderHrefs = { [lease.id]: `${ledgerHref}#reminder-review` };

  const ledgerActions = (
    <span className={styles.actionRow}>
      {lease.status === 'ACTIVE' && (
        <a
          className="btn btn-secondary btn-sm"
          // Carries this lease so Payments records against it, never a sibling term.
          href={`${paymentsHref}${paymentsHref.includes('?') ? '&' : '?'}record=1&lease=${encodeURIComponent(lease.id)}`}
        >
          Record payment
        </a>
      )}
      <GoLink
        href={paymentsHref}
        label={`Payments: open ${lease.unit.isImplicit ? 'property' : 'unit'} Payments to create charges and send reminders`}
      >
        Payments
      </GoLink>
    </span>
  );
  const late = lateLine(ledgerRows, lease.graceDays);
  const ledgerNotes = late ? <p className={styles.lateLine}>{late}</p> : null;
  const ledgerFooter = (full: boolean) => (
    <>
      <span className="muted">
        Late means unpaid after the {lease.graceDays}-day grace period. Scheduled charges are
        upcoming.
      </span>
      {full ? (
        <GoLink href={ledgerHref}>Full ledger &amp; reminder review</GoLink>
      ) : (
        <GoLink href={`${ledgerHref}#reminder-review`}>Review balance before any reminder</GoLink>
      )}
    </>
  );
  const noticeLine = `Notice: ${noticeGiven ? formatDate(lease.noticeGivenAt!) : 'none given'} · Move-out: ${lease.moveOutDate ? formatDate(lease.moveOutDate) : 'not scheduled'}`;

  const termsCard = (
    <section className={`${styles.section} ${styles.termsCard}`} aria-labelledby="lease-terms-card">
      <SectionHeader title="Terms" id="lease-terms-card" />
      <dl className={styles.termStats}>
        <div>
          <dt>Monthly rent</dt>
          <dd>{money(lease.monthlyRent)}</dd>
          <small>Due on the {dueDay}</small>
        </div>
        <div>
          <dt>Deposit</dt>
          <dd>{money(lease.deposit)}</dd>
          <small>Security deposit</small>
        </div>
      </dl>
      <dl className={styles.compactFacts}>
        <dt>Term</dt>
        <dd>{term(lease.startDate, lease.endDate)}</dd>
        <dt>Late fee</dt>
        <dd>
          {money(lease.lateFee)} after a {lease.graceDays}-day grace period
        </dd>
        <dt>Notice</dt>
        <dd>{noticeGiven ? formatDate(lease.noticeGivenAt!) : 'No notice given'}</dd>
        <dt>Move-out</dt>
        <dd>{lease.moveOutDate ? formatDate(lease.moveOutDate) : 'Not scheduled'}</dd>
      </dl>
      <div className={styles.cardFoot}>
        <GoLink href={tabHref('agreement')}>Manage agreement &amp; notice</GoLink>
      </div>
    </section>
  );

  const documentsCard = (
    <section className={styles.section} aria-labelledby="lease-documents-card">
      <SectionHeader title="Documents" id="lease-documents-card" />
      <h3 className="eyebrow">Signed agreement</h3>
      <div className={styles.docLine}>
        {signature.signedFileId ? (
          <>
            <span className={styles.docName}>
              <strong>
                {leaseFile?.id === signature.signedFileId
                  ? leaseFile.name
                  : 'Signed lease agreement.pdf'}
              </strong>
              <Badge tone="success">Signed</Badge>
            </span>
            <a
              className="btn btn-secondary btn-sm"
              href={`/api/files/${encodeURIComponent(signature.signedFileId)}/download`}
              aria-label="Download the signed lease agreement"
            >
              Download
            </a>
          </>
        ) : signature.pdfMissing ? (
          <>
            <span className={styles.docName}>
              <strong>Signed PDF unavailable</strong>
              <small>Signatures are recorded on the lease.</small>
            </span>
            <a
              className="btn btn-secondary btn-sm"
              href={tabHref('agreement')}
              aria-label="Retry: check the signed PDF again from the agreement"
            >
              Retry
            </a>
          </>
        ) : (
          <span className={styles.docName}>
            <strong>{signature.headline}</strong>
          </span>
        )}
      </div>
      <h3 className="eyebrow">Addendums</h3>
      {addendums.length ? (
        <ul className={styles.plainList}>
          {addendums.map((file) => (
            <li key={file.id} className={styles.docLine}>
              <span className={styles.docName}>
                <strong>{file.name}</strong>
                <small>{formatDate(file.createdAt)}</small>
              </span>
              <a
                className="btn btn-ghost btn-sm"
                href={`/api/files/${encodeURIComponent(file.id)}/download`}
                aria-label={`Download ${file.name}`}
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No addendums yet.</p>
      )}
      <div className={styles.cardFoot}>
        <Link
          className="btn btn-secondary btn-sm"
          href="/leases/templates"
          aria-label="Add addendum from lease templates"
        >
          Add addendum
        </Link>
        <GoLink href={tabHref('documents')}>{`Lease files (${lease.documents.length})`}</GoLink>
        <GoLink href="/documents">Portfolio documents</GoLink>
      </div>
    </section>
  );

  const activityCard = (
    <section className={styles.section} aria-labelledby="lease-activity-card">
      <SectionHeader title="Activity" id="lease-activity-card" />
      <ol className={styles.timeline}>
        {activities.slice(0, 5).map((item, index) => (
          <li className={styles.event} key={index}>
            <span className={styles.eventDot} aria-hidden="true" />
            <span className="file-meta">
              <strong>{item.text}</strong>
              <small>{formatDate(item.date)}</small>
            </span>
          </li>
        ))}
      </ol>
      {activities.length > 5 && (
        <div className={styles.cardFoot}>
          <GoLink href={tabHref('activity')} label={`All activity: ${activities.length} events`}>
            All activity
          </GoLink>
        </div>
      )}
      {/* Phones fold the Terms card away; notice and move-out stay here. */}
      <p className={styles.phoneCaption}>{noticeLine}</p>
    </section>
  );

  const sideColumn = (
    <div className={`${styles.sideCol} ${styles.foldTerms}`}>
      {termsCard}
      {documentsCard}
      {activityCard}
    </div>
  );

  return (
    <>
      <PageHeader
        title={title}
        eyebrow={`Lease · ${formatDate(lease.startDate)} → ${formatDate(lease.endDate)}`}
        back={{ href: backHref, label: scoped ? `${property.name} leases` : 'Leases' }}
        meta={`${placeText} · ${money(lease.monthlyRent)}/mo · Online payments ${onlinePaymentsEnabled ? 'enabled' : 'not connected'}`}
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
        <section className={styles.summaryLine} aria-label="Lease summary">
          <Badge tone={status.tone}>{status.label}</Badge>
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
          <span>
            {placeText} · {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
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

        {/* Signing state from stored records; the Agreement tab holds the full signer panel. */}
        <section
          className={styles.signing}
          data-state={signature.state}
          aria-label="Agreement signing"
        >
          <span className={styles.signingIcon} aria-hidden="true">
            <ActionGlyph name={signature.state === 'done' ? 'check' : 'signature'} />
          </span>
          <div className={styles.signingText}>
            <strong>{signature.headline}</strong>
            <p>{signature.caption}</p>
            {signature.signers.length > 0 && (
              <ul className={styles.signers} aria-label="Signers">
                {signature.signers.map((signer) => (
                  <li key={signer.key}>
                    <span>{signer.label}</span>
                    <Badge tone={signer.note ? 'info' : signer.signed ? 'success' : 'neutral'}>
                      {signer.note ?? (signer.signed ? 'Signed' : 'Awaiting')}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className={styles.signingActions}>
            {activeTab !== 'agreement' && (
              <a
                className={`btn btn-sm ${
                  signature.state === 'done' || lease.status === 'DRAFT'
                    ? 'btn-secondary'
                    : 'btn-primary'
                }`}
                href={tabHref('agreement')}
                // The accessible name starts with the visible words and keeps the agreement context.
                aria-label={
                  signature.state === 'done'
                    ? 'Review signatures and the agreement'
                    : 'Review signatures on the lease agreement'
                }
              >
                Review signatures
              </a>
            )}
            {signature.pdfMissing && activeTab !== 'agreement' && (
              // Opening the agreement re-runs the stored PDF retry; signatures are never redone.
              <a
                className="btn btn-secondary btn-sm"
                href={tabHref('agreement')}
                aria-label="Retry PDF: check the signed PDF again from the agreement"
              >
                Retry PDF
              </a>
            )}
            {activeTab !== 'documents' && (
              <a className="btn btn-secondary btn-sm" href={tabHref('documents')}>
                Review lease files
              </a>
            )}
            <a
              className="btn btn-ghost btn-sm"
              href={`/sign/leases/${lease.id}`}
              aria-label="Signing page: open the owner / lessor signing page"
            >
              Signing page
            </a>
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
              {'short' in tab ? (
                <>
                  <span className={styles.tabLong}>{tab.label}</span>
                  <span className={styles.tabShort} aria-hidden="true">
                    {tab.short}
                  </span>
                </>
              ) : (
                tab.label
              )}
            </a>
          ))}
        </LeaseSectionNavigation>
        <div className={styles.panel} id={`lease-${activeTab}`}>
          {activeTab === 'overview' && (
            <div className={styles.grid}>
              <div className={styles.mainCol}>
                <RentLedger
                  scope={ledgerScope}
                  balanceCents={ledger.balanceCents}
                  lastPayment={lastPayment}
                  actions={ledgerActions}
                  notes={ledgerNotes}
                  footer={ledgerFooter(false)}
                >
                  <RentLedgerRows
                    groups={[
                      {
                        id: lease.id,
                        heading: `${title} · recent charges`,
                        meta: '',
                        balanceCents: ledger.balanceCents,
                        active: lease.status === 'ACTIVE',
                        rows: recentLedgerRows(ledgerRows),
                      },
                    ]}
                    groupHeadings={false}
                    compact
                    reminderHrefs={reminderHrefs}
                  />
                </RentLedger>
              </div>
              {sideColumn}
              {/* After the side cards in reading order so phones show ledger, documents, activity first. */}
              <div className={styles.pairArea}>
                <div className={styles.pair}>
                  <section className={styles.section} aria-labelledby="lease-premises">
                    <SectionHeader
                      title="Leased premises"
                      id="lease-premises"
                      action={<GoLink href={`/properties/${property.id}`}>Property</GoLink>}
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
                  <section className={styles.section} aria-labelledby="lease-tenants">
                    <SectionHeader
                      title="Tenants on this lease"
                      id="lease-tenants"
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
                </div>
              </div>
            </div>
          )}
          {activeTab === 'agreement' && (
            <>
              {lease.eSignStatus !== 'NOT_SENT' && (
                <details className={styles.prepare}>
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
            <div className={styles.grid}>
              <section className={styles.section} id="documents" aria-labelledby="lease-files">
                <SectionHeader
                  title="Lease documents"
                  id="lease-files"
                  action={<GoLink href="/documents">Portfolio documents</GoLink>}
                />
                <p className={`muted ${styles.lede}`}>
                  Files owned by this lease · {lease.documents.length}{' '}
                  {lease.documents.length === 1 ? 'file' : 'files'}
                </p>
                <LeaseDocumentGrid
                  leaseId={lease.id}
                  withUploader
                  documents={lease.documents.map((file) => ({
                    id: file.id,
                    name: file.name,
                    kind: file.kind.toLowerCase(),
                    uploaded: formatDate(file.createdAt),
                    mimeType: file.mimeType,
                    size: formatFileSize(Number(file.sizeBytes)) || undefined,
                    // A historical file is on record, not proof of signatures (as in Documents).
                    signed: file.id === signature.signedFileId && !signature.historical,
                  }))}
                />
              </section>
              <div className={styles.sideCol}>{termsCard}</div>
            </div>
          )}
          {activeTab === 'payments' && (
            <div className={styles.grid}>
              <div className={styles.mainCol}>
                <RentLedger
                  scope={ledgerScope}
                  balanceCents={ledger.balanceCents}
                  lastPayment={lastPayment}
                  actions={ledgerActions}
                  notes={ledgerNotes}
                  footer={ledgerFooter(true)}
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
                        payments: toPaymentViews(ledger.payments),
                      },
                    ]}
                    groupHeadings={false}
                    reminderHrefs={reminderHrefs}
                  />
                </RentLedger>
              </div>
              {sideColumn}
            </div>
          )}
          {activeTab === 'activity' && (
            <div className={styles.grid}>
              <section className={styles.section} aria-labelledby="lease-activity">
                <SectionHeader title="Activity" id="lease-activity" />
                <ol className={styles.timeline}>
                  {activities.map((item, index) => (
                    <li className={styles.event} key={index}>
                      <span className={styles.eventDot} aria-hidden="true" />
                      <span className="file-meta">
                        <strong>{item.text}</strong>
                        <small>{formatDate(item.date)}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className={styles.section} aria-labelledby="lease-esign-history">
                <SectionHeader
                  title="E-signature history"
                  id="lease-esign-history"
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
                <a
                  className="btn btn-secondary btn-sm"
                  href={tabHref('agreement')}
                  aria-label="Signature status: see each party's current signature status"
                >
                  Signature status
                </a>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
