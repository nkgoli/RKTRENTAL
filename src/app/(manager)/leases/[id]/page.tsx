import { SigningPanel } from '@/components/lease-signing/SigningPanel';
import { SendAgreementButton } from '@/components/lease-signing/SendAgreementButton';
import { DeleteDraftButton } from '@/components/lease-create/DeleteDraftButton';
import { draftRenewalSources } from '@/lib/lease-create/delete-draft';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import type { ReactNode } from 'react';
import { workspaceTabHref } from '@/components/workspace/routes';
import { ActionGlyph, Alert, Avatar, Badge, cx } from '@/components/ui';
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
import { EditTermsForm, FormDisclosure, LeaseStatusActions, NoticeForm } from '../LeaseForms';
import type { TemplateItem } from '@/lib/lease-create/templates';
import { RentLedger, RentLedgerRows } from '@/components/payments/RentLedger';
import {
  recentLedgerRows,
  toLastPayment,
  toLedgerRows,
  toPaymentViews,
} from '@/components/payments/ledger-view';
import {
  ensureRentCharges,
  formatMoney,
  leaseLedger,
  periodLabel,
  previewScheduledCharges,
} from '@/lib/ledger';
import {
  formatFileSize,
  lateLine,
  leaseStatusBadge,
  ordinal,
  signatureBanner,
  signatureSummary,
  termProgress,
  type SignatureSummary,
} from './lease-view';

/** Unfilled blanks in saved wording read as a small chip naming the field. */
const showSignedBody = (body: string) =>
  body.split(/(\{\{[a-z_]+\}\})/g).map((part, index) =>
    /^\{\{[a-z_]+\}\}$/.test(part) ? (
      <mark key={index}>
        <span className={styles.srOnly}>Blank: </span>
        {part.slice(2, -2).replaceAll('_', ' ')}
      </mark>
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

const SECTION_LABEL = { CLAUSE: 'Clauses', RULE: 'Rules', DISCLOSURE: 'Disclosures' } as const;
const SECTION_NOUN = {
  CLAUSE: ['clause', 'clauses'],
  RULE: ['rule', 'rules'],
  DISCLOSURE: ['disclosure', 'disclosures'],
} as const;

/** Whole cents from a stored decimal; missing or invalid values count as zero. */
const toCents = (value: { toString(): string } | null | undefined) =>
  Math.round((Number(value?.toString() ?? 0) || 0) * 100);

/** "$1,855" with the cents in a quieter ".00", so the figures line up without shouting. */
function Amount({ cents }: { cents: number }) {
  const [whole, fraction] = formatMoney(cents).split('.');
  return (
    <>
      {whole}
      <span className={styles.cents}>.{fraction}</span>
    </>
  );
}

function CardHead({ title, id, children }: { title: string; id: string; children?: ReactNode }) {
  return (
    <div className={styles.cardHead}>
      <h2 id={id}>{title}</h2>
      {children}
    </div>
  );
}

/** A quiet text link with a trailing arrow, e.g. "View rent ledger →". */
function GoLink({ href, children, label }: { href: string; children: string; label?: string }) {
  return (
    <a className={styles.goLink} href={href} aria-label={label}>
      {children} <span aria-hidden="true">→</span>
    </a>
  );
}

/** Each signer with a Signed / Awaiting pill (or what to verify on a historical lease). */
function SignerList({ signers }: { signers: SignatureSummary['signers'] }) {
  if (!signers.length) return null;
  return (
    <ul className={styles.signers} aria-label="Signers">
      {signers.map((signer) => (
        <li key={signer.key}>
          <span>{signer.label}</span>
          <Badge tone={signer.note ? 'info' : signer.signed ? 'success' : 'neutral'}>
            {signer.note ?? (signer.signed ? 'Signed' : 'Awaiting')}
          </Badge>
        </li>
      ))}
    </ul>
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
  // The Agreement tab holds the full signing section, so the banner stays off it.
  const banner = activeTab === 'agreement' ? null : signatureBanner(signature, lease, formatDate);
  const status = leaseStatusBadge(lease, now);
  const progress = termProgress(lease, now, formatDate);
  const dueDay = ordinal(lease.rentDueDay);
  const editable = lease.status === 'ACTIVE' || lease.status === 'DRAFT';
  // Primary tenant first: the header names them, the Tenants card marks them.
  const people = [...lease.tenants].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const names = people.map(({ tenant }) => tenant.name);
  const tenantLine = !names.length
    ? 'No tenants yet'
    : names.length <= 2
      ? names.join(', ')
      : `${names[0]} +${names.length - 1}`;
  const ledgerScope = [
    periodLabel({ start: lease.startDate, end: lease.endDate }, ledger.rows),
    lease.status === 'ACTIVE' ? '' : status.label,
  ]
    .filter(Boolean)
    .join(' · ');
  const addendums = lease.documents.filter((d) => d.kind === 'ADDENDUM');
  // Late rows open this lease's reminder review; a reminder is never sent from the ledger.
  // A plain object: this server page cannot hand functions to the client ledger rows.
  const reminderHrefs = { [lease.id]: `${ledgerHref}#reminder-review` };
  const late = lateLine(ledgerRows, lease.graceDays);
  const ledgerNotes = late ? <p className={styles.lateLine}>{late}</p> : null;
  const signedFileName =
    signature.signedFileId && leaseFile?.id === signature.signedFileId
      ? leaseFile.name
      : 'Signed lease agreement.pdf';

  const rentCents = toCents(lease.monthlyRent);
  const depositCents = toCents(lease.deposit);
  const petCents = toCents(lease.petDeposit);
  const depositDetail = petCents ? `+ ${formatMoney(petCents)} pet deposit` : undefined;
  const nextCharge = ledgerRows.filter((r) => r.status === 'SCHEDULED').at(-1);
  // A draft has no ledger yet: show what sending or activating it will charge.
  const preview =
    lease.status === 'DRAFT'
      ? previewScheduledCharges({
          startDate: lease.startDate,
          endDate: lease.endDate,
          asOf: now,
          fees: {
            monthlyRentCents: rentCents,
            depositCents,
            moveInFeeCents: toCents(lease.moveInFee),
            petDepositCents: petCents,
            prorateFirstMonth: Boolean(lease.prorateFirstMonth),
            rentDueDay: lease.rentDueDay,
          },
        })
      : null;
  const firstRent = preview?.monthly[0];
  const tiles: { label: string; value: ReactNode; detail?: string; danger?: boolean }[] = [
    { label: 'Monthly rent', value: <Amount cents={rentCents} />, detail: `Due on the ${dueDay}` },
    { label: 'Deposit', value: <Amount cents={depositCents} />, detail: depositDetail },
    ...(preview
      ? [
          {
            label: 'Due at move-in',
            value: <Amount cents={preview.moveInTotalCents} />,
            detail: preview.moveIn.length ? `On ${formatDate(lease.startDate)}` : undefined,
          },
          {
            label: 'First rent',
            value: firstRent ? <Amount cents={firstRent.amountCents} /> : '—',
            detail: firstRent ? `Due ${formatDate(firstRent.date)}` : undefined,
          },
        ]
      : [
          {
            label: ledger.balanceCents < 0 ? 'Credit' : 'Balance due',
            value: <Amount cents={Math.abs(ledger.balanceCents)} />,
            detail: late
              ? 'Past due'
              : lastPayment
                ? `Last paid ${lastPayment.dateLabel}`
                : 'No payments yet',
            danger: Boolean(late),
          },
          {
            label: 'Next charge',
            value: nextCharge ? <Amount cents={nextCharge.amountCents} /> : '—',
            detail: nextCharge
              ? `${nextCharge.type === 'Rent' ? '' : `${nextCharge.description} · `}Due ${nextCharge.dateLabel}`
              : 'Nothing scheduled',
          },
        ]),
  ];
  const sectionCounts = (['CLAUSE', 'RULE', 'DISCLOSURE'] as const)
    .map((section) => ({
      section,
      items: snapshotItems.filter((item) => item.section === section),
    }))
    .filter((group) => group.items.length);

  const activityList = (items: typeof activities) => (
    <ol className={styles.timeline}>
      {items.map((item, index) => (
        <li className={styles.event} key={index}>
          <span className={styles.eventDot} aria-hidden="true" />
          <span className={styles.eventText}>
            <strong>{item.text}</strong>
            <small>{formatDate(item.date)}</small>
          </span>
        </li>
      ))}
    </ol>
  );

  const agreementLine = signature.signedFileId ? (
    <span className={styles.docLine}>
      <a
        href={`/api/files/${encodeURIComponent(signature.signedFileId)}/download`}
        aria-label={`${signedFileName}: download the signed lease agreement`}
      >
        {signedFileName}
      </a>
      <Badge tone="success">Signed</Badge>
    </span>
  ) : signature.pdfMissing ? (
    'PDF not stored'
  ) : (
    signature.headline
  );

  /** Terms, tenants, unit and documents: one quiet column beside the overview's charges. */
  const detailsCard = (
    <aside className={cx(styles.card, styles.details)} aria-label="Lease details">
      <section aria-labelledby="lease-terms-card">
        <CardHead title="Terms" id="lease-terms-card">
          <GoLink href={tabHref('agreement')}>Manage agreement</GoLink>
        </CardHead>
        <dl className={styles.facts}>
          <div>
            <dt>Term</dt>
            <dd>{term(lease.startDate, lease.endDate)}</dd>
          </div>
          <div>
            <dt>Late fee</dt>
            <dd>
              {money(lease.lateFee)} after a {lease.graceDays}-day grace period
            </dd>
          </div>
          {lease.occupants && (
            <div>
              <dt>Occupants</dt>
              <dd>{lease.occupants}</dd>
            </div>
          )}
          <div>
            <dt>Notice</dt>
            <dd>{noticeGiven ? formatDate(lease.noticeGivenAt!) : 'No notice given'}</dd>
          </div>
          <div>
            <dt>Move-out</dt>
            <dd>{lease.moveOutDate ? formatDate(lease.moveOutDate) : 'Not scheduled'}</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="lease-tenants">
        <CardHead title="Tenants" id="lease-tenants" />
        {people.length ? (
          <ul className={styles.people}>
            {people.map(({ tenant, isPrimary }) => (
              <li key={tenant.id}>
                <Avatar initials={initials(tenant.name)} />
                <span className={styles.person}>
                  <span className={styles.personName}>
                    <a href={`/tenants/${tenant.id}`}>{tenant.name}</a>
                    {isPrimary && people.length > 1 && <Badge>Primary</Badge>}
                  </span>
                  <small>{tenant.email ?? 'No email'}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No tenants yet.</p>
        )}
      </section>
      <section aria-labelledby="lease-unit">
        <CardHead title="Unit" id="lease-unit" />
        <p className={styles.unitLine}>
          <a href={`/properties/${property.id}`}>{property.name}</a>
          {!lease.unit.isImplicit && (
            <>
              {' · '}
              <a href={`/properties/${property.id}/units/${lease.unitId}`}>
                Unit {lease.unit.number}
              </a>
            </>
          )}
        </p>
        <p className="muted">{formatAddress(property)}</p>
      </section>
      <section aria-labelledby="lease-documents-card">
        <CardHead title="Documents" id="lease-documents-card">
          <GoLink href={tabHref('documents')}>Lease documents</GoLink>
        </CardHead>
        <dl className={styles.facts}>
          <div>
            <dt>Agreement</dt>
            <dd>{agreementLine}</dd>
          </div>
          <div>
            <dt>Addenda</dt>
            <dd>{addendums.length || 'None'}</dd>
          </div>
        </dl>
        {!signature.historical && <SignerList signers={signature.signers} />}
      </section>
    </aside>
  );

  /** Rent, deposit and late fee beside the full ledger. */
  const paymentTermsCard = (
    <section className={styles.card} aria-labelledby="lease-payment-terms">
      <CardHead title="Payment terms" id="lease-payment-terms" />
      <dl className={styles.facts}>
        <div>
          <dt>Rent</dt>
          <dd>
            {money(lease.monthlyRent)} · due on the {dueDay}
          </dd>
        </div>
        <div>
          <dt>Deposit</dt>
          <dd>{money(lease.deposit)}</dd>
        </div>
        <div>
          <dt>Late fee</dt>
          <dd>
            {money(lease.lateFee)} after a {lease.graceDays}-day grace period
          </dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{term(lease.startDate, lease.endDate)}</dd>
        </div>
      </dl>
    </section>
  );

  /** The signed agreement and who has signed it, beside the lease documents. */
  const agreementCard = (
    <section className={styles.card} aria-labelledby="lease-signed-agreement">
      <CardHead title="Signed agreement" id="lease-signed-agreement">
        <Badge tone={signature.badge.tone}>{signature.badge.label}</Badge>
      </CardHead>
      <p className={styles.agreementState}>
        {signature.signedFileId
          ? signedFileName
          : signature.pdfMissing
            ? `${signature.signedOn ? `Signed ${formatDate(signature.signedOn)}` : 'Marked signed'} · PDF not stored`
            : signature.headline}
      </p>
      {signature.signedFileId && (
        <a
          className="btn btn-secondary btn-sm"
          href={`/api/files/${encodeURIComponent(signature.signedFileId)}/download`}
          aria-label="Download the signed lease agreement"
        >
          Download
        </a>
      )}
      <SignerList signers={signature.signers} />
      <div className={styles.cardFoot}>
        <a
          className={styles.goLink}
          href={`/sign/leases/${lease.id}`}
          aria-label="Signing page: open the owner / lessor signing page"
        >
          Signing page
        </a>
      </div>
    </section>
  );

  return (
    <>
      <PageHeader
        title={title}
        back={{ href: backHref, label: scoped ? `${property.name} leases` : 'Leases' }}
        meta={`${tenantLine} · ${term(lease.startDate, lease.endDate)} · ${money(lease.monthlyRent)}/mo`}
        actions={[
          ...(lease.status === 'ACTIVE'
            ? [
                {
                  label: 'Record payment',
                  // Carries this lease so Payments records against it, never a sibling term.
                  href: `${paymentsHref}${paymentsHref.includes('?') ? '&' : '?'}record=1&lease=${encodeURIComponent(lease.id)}`,
                },
                { label: 'Renew lease', href: `/leases/new?renew=${lease.id}`, primary: true },
              ]
            : []),
          ...(lease.status === 'DRAFT'
            ? [
                {
                  label: 'Continue in lease wizard',
                  href: `/leases/new?draft=${lease.id}`,
                  primary: true,
                },
              ]
            : []),
        ]}
      />

      <div className={styles.workspace}>
        <section className={styles.strip} aria-label="Lease summary">
          <span className={styles.pills}>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={signature.badge.tone}>{signature.badge.label}</Badge>
            {noticeGiven && (
              <Badge tone="warning">Notice given {formatDate(lease.noticeGivenAt!)}</Badge>
            )}
          </span>
          <span className={styles.progress}>
            <span>
              <strong>{progress.label}</strong> · {progress.detail}
            </span>
            {progress.percent !== null && (
              <span
                className={styles.meter}
                role="meter"
                aria-label="Lease term elapsed"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
                aria-valuetext={progress.label}
              >
                <span style={{ width: `${progress.percent}%` }} />
              </span>
            )}
          </span>
        </section>

        {/* Shown only when someone has to act; stored state only, no status checks run here. */}
        {banner && (
          <section className={styles.banner} data-state={signature.state} aria-label="Agreement signing">
            <span className={styles.bannerIcon} aria-hidden="true">
              <ActionGlyph name="signature" />
            </span>
            <p className={styles.bannerText}>
              <strong>{banner.title}</strong>
              {banner.detail && <span>{banner.detail}</span>}
            </p>
            {banner.action && banner.action.tab !== activeTab && (
              <a
                className="btn btn-secondary btn-sm"
                href={tabHref(banner.action.tab)}
                // The accessible name starts with the visible words and keeps the context.
                aria-label={banner.action.ariaLabel}
              >
                {banner.action.label}
              </a>
            )}
          </section>
        )}

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
            <>
              <dl className={styles.tiles} aria-label="Lease figures">
                {tiles.map((tile) => (
                  <div key={tile.label} className={styles.tile}>
                    <dt>{tile.label}</dt>
                    <dd>
                      <span className={styles.tileValue} data-tone={tile.danger ? 'danger' : undefined}>
                        {tile.value}
                      </span>
                      {tile.detail && <span className={styles.tileDetail}>{tile.detail}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className={styles.grid}>
                <div className={styles.mainCol}>
                  <section className={styles.card} aria-labelledby="lease-charges">
                    <CardHead title="Charges" id="lease-charges">
                      <GoLink href={tabHref('payments')}>View rent ledger</GoLink>
                    </CardHead>
                    {ledgerNotes}
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
                      emptyText={lease.status === 'DRAFT' ? 'No charges yet.' : undefined}
                      reminderHrefs={reminderHrefs}
                    />
                  </section>
                  <section className={styles.card} aria-labelledby="lease-activity-card">
                    <CardHead title="Activity" id="lease-activity-card">
                      {activities.length > 5 && (
                        <GoLink
                          href={tabHref('activity')}
                          label={`All activity: ${activities.length} events`}
                        >
                          All activity
                        </GoLink>
                      )}
                    </CardHead>
                    {activityList(activities.slice(0, 5))}
                  </section>
                </div>
                {detailsCard}
              </div>
            </>
          )}
          {activeTab === 'agreement' && (
            <>
              {(saved === 'activated' || saved === 'terminated') && (
                <Alert tone="success">{leaseResultMessages[saved]}</Alert>
              )}
              <div className={styles.split}>
                <section className={styles.card} aria-labelledby="lease-terms-heading">
                  <CardHead title="Lease terms" id="lease-terms-heading">
                    {editable && (
                      <FormDisclosure label="Edit terms" open={saved === 'terms'}>
                        <EditTermsForm
                          leaseId={lease.id}
                          values={terms}
                          returnScope={returnScope}
                          saved={saved === 'terms'}
                        />
                      </FormDisclosure>
                    )}
                  </CardHead>
                  <dl className={styles.factGrid}>
                    <div>
                      <dt>Term</dt>
                      <dd>
                        {term(lease.startDate, lease.endDate)}
                        <small>
                          {progress.months} {progress.months === 1 ? 'month' : 'months'}
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>Monthly rent</dt>
                      <dd>
                        {money(lease.monthlyRent)}
                        <small>Due on the {dueDay}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Security deposit</dt>
                      <dd>
                        {money(lease.deposit)}
                        {depositDetail && <small>{depositDetail}</small>}
                      </dd>
                    </div>
                    <div>
                      <dt>Late fee</dt>
                      <dd>
                        {money(lease.lateFee)}
                        <small>After a {lease.graceDays}-day grace period</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Occupants</dt>
                      <dd>{lease.occupants ?? '—'}</dd>
                    </div>
                  </dl>
                </section>
                <section
                  className={styles.card}
                  id="lease-notice-card"
                  aria-labelledby="lease-notice-heading"
                >
                  <CardHead title="Notice & move-out" id="lease-notice-heading">
                    {lease.status === 'ACTIVE' && (
                      <FormDisclosure
                        label={noticeGiven ? 'Update notice' : 'Record notice'}
                        open={saved === 'notice'}
                      >
                        <NoticeForm
                          leaseId={lease.id}
                          noticeGivenAt={lease.noticeGivenAt ? dateInput(lease.noticeGivenAt) : ''}
                          moveOutDate={lease.moveOutDate ? dateInput(lease.moveOutDate) : ''}
                          returnScope={returnScope}
                          saved={saved === 'notice'}
                        />
                      </FormDisclosure>
                    )}
                  </CardHead>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Notice given</dt>
                      <dd>{noticeGiven ? formatDate(lease.noticeGivenAt!) : 'No notice given'}</dd>
                    </div>
                    <div>
                      <dt>Planned move-out</dt>
                      <dd>{lease.moveOutDate ? formatDate(lease.moveOutDate) : 'Not scheduled'}</dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section className={styles.card} aria-labelledby="lease-esign">
                <CardHead title="E-signatures" id="lease-esign">
                  <span className={styles.headExtras}>
                    <Badge tone={signature.badge.tone}>{signature.badge.label}</Badge>
                    <a
                      className={styles.goLink}
                      href={`/sign/leases/${lease.id}`}
                      aria-label="Signing page: open the owner / lessor signing page"
                    >
                      Signing page
                    </a>
                  </span>
                </CardHead>
                {lease.eSignStatus === 'NOT_SENT' ? (
                  <SendAgreementButton leaseId={lease.id} />
                ) : (
                  <>
                    {agreement ? (
                      <SigningPanel leaseId={lease.id} documentsHref={tabHref('documents')} />
                    ) : (
                      // No signing record to load: say what is stored instead of a failed lookup.
                      <>
                        <p className={styles.agreementState}>
                          {signature.signedOn
                            ? `Signed ${formatDate(signature.signedOn)}`
                            : signature.headline}
                          {signature.historical &&
                            (leaseFile ? ` · ${leaseFile.name} on file` : ' · PDF not stored')}
                        </p>
                        <SignerList signers={signature.signers} />
                      </>
                    )}
                    <details className={styles.prepare}>
                      <summary>Prepare current signing version</summary>
                      <SendAgreementButton leaseId={lease.id} />
                    </details>
                  </>
                )}
              </section>

              {signedTerms && (
                <section className={styles.card} aria-labelledby="terms-as-signed">
                  <CardHead title="Prepared lease terms" id="terms-as-signed" />
                  <div className={styles.templateLine}>
                    <span className={styles.docIcon} aria-hidden="true">
                      <Icon name="leases" />
                    </span>
                    <span>
                      <span className={styles.templateName}>
                        <strong>{snapshotTemplate?.name ?? 'Lease template'}</strong>
                        <Badge>v{lease.templateVersion ?? 1}</Badge>
                      </span>
                      <small>
                        {[
                          ...sectionCounts.map(
                            ({ section, items }) =>
                              `${items.length} ${SECTION_NOUN[section][items.length === 1 ? 0 : 1]}`,
                          ),
                          lease.signedAt
                            ? `Signed ${formatDate(lease.signedAt)}`
                            : 'Sent for signature',
                        ].join(' · ')}
                      </small>
                    </span>
                  </div>
                  {snapshotItems.length > 0 && (
                    <details className={styles.wording}>
                      <summary>
                        Show all {snapshotItems.length} clauses, rules and disclosures
                      </summary>
                      <div className={styles.desk}>
                        <article className={styles.paper} aria-label="Prepared lease wording">
                          {sectionCounts.map(({ section, items }) => (
                            <section key={section}>
                              <h3>{SECTION_LABEL[section]}</h3>
                              <ol>
                                {items.map((item) => (
                                  <li key={item.id}>
                                    <h4>{item.title}</h4>
                                    <p>{showSignedBody(item.body)}</p>
                                  </li>
                                ))}
                              </ol>
                            </section>
                          ))}
                        </article>
                      </div>
                    </details>
                  )}
                </section>
              )}

              <section className={cx(styles.card, styles.rowCard)} aria-labelledby="lease-addenda">
                <span>
                  <h2 id="lease-addenda">Amendments &amp; addenda</h2>
                  <small>
                    {addendums.length
                      ? `${addendums.length} on file`
                      : 'None on this lease'}
                  </small>
                </span>
                <Link className="btn btn-secondary btn-sm" href="/leases/templates">
                  Browse templates
                </Link>
              </section>

              {editable && (
                <section
                  className={cx(styles.card, styles.actionsCard)}
                  id="lease-actions"
                  aria-labelledby="lease-actions-heading"
                >
                  <CardHead title="Lease actions" id="lease-actions-heading" />
                  <LeaseStatusActions
                    placeLabel={title}
                    leaseId={lease.id}
                    status={lease.status}
                    returnScope={returnScope}
                  />
                  {deletable && (
                    <div className={styles.statusAction}>
                      <div>
                        <strong>Delete draft</strong>
                        <p>Removes this unsent draft for good.</p>
                      </div>
                      <DeleteDraftButton
                        leaseId={lease.id}
                        placeLabel={title}
                        tenantName={names.join(', ') || undefined}
                        renewal={renewal}
                        fileCount={lease.documents.length}
                        returnTo={returnScope ?? 'leases'}
                      />
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {activeTab === 'documents' && (
            <div className={styles.grid}>
              <section
                className={styles.card}
                id="documents"
                aria-labelledby="lease-files"
              >
                <CardHead title="Lease documents" id="lease-files">
                  <GoLink href="/documents">Portfolio documents</GoLink>
                </CardHead>
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
              <div className={styles.sideCol}>{agreementCard}</div>
            </div>
          )}
          {activeTab === 'payments' && (
            <div className={styles.grid}>
              <div className={styles.mainCol}>
                <RentLedger
                  scope={ledgerScope}
                  balanceCents={ledger.balanceCents}
                  lastPayment={lastPayment}
                  actions={
                    <GoLink
                      href={paymentsHref}
                      label={`Payments: open ${lease.unit.isImplicit ? 'property' : 'unit'} Payments to create charges and send reminders`}
                    >
                      Payments
                    </GoLink>
                  }
                  notes={ledgerNotes}
                  footer={<GoLink href={ledgerHref}>Full ledger &amp; reminder review</GoLink>}
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
              <div className={styles.sideCol}>{paymentTermsCard}</div>
            </div>
          )}
          {activeTab === 'activity' && (
            <div className={styles.grid}>
              <section className={styles.card} aria-labelledby="lease-activity">
                <CardHead title="Activity" id="lease-activity" />
                {activityList(activities)}
              </section>
              <section className={styles.card} aria-labelledby="lease-esign-history">
                <CardHead title="E-signature history" id="lease-esign-history">
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
                </CardHead>
                <p className={styles.agreementState}>
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
