import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { Alert, Badge, Button, Card, cx, pageFrom, paginate } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { describePaymentReference } from '@/lib/ledger';
import { formatBytes, formatDate, formatMoney, initials } from '@/lib/tenants/format';
import { organizationTenants, type TenantDetail } from '@/lib/tenants/queries';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/tenants/status';
import { addNoteAction, moveInAction, moveOutAction, updateTenantAction } from '../actions';
import { AddNoteForm, EditTenantForm, MoveOutDialog } from '../TenantForms';
import { tenantReturnHref } from '../navigation';
import { TenantPager } from '../Pager';
import styles from '../tenants.module.css';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAYMENT_TONE = {
  SUCCEEDED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'neutral',
} as const;
const PAYMENT_LABEL = {
  SUCCEEDED: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
} as const;
const LEASE_LABEL = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ENDED: 'Ended',
  TERMINATED: 'Terminated',
} as const;

function unitLabel(lease: TenantDetail['leases'][number]) {
  const { unit } = lease;
  return unit.isImplicit ? unit.property.name : `${unit.property.name} · Unit ${unit.number}`;
}

function history(detail: TenantDetail) {
  const events: { at: Date; title: string; meta: string }[] = [];
  for (const note of detail.tenant.notes) {
    events.push({ at: note.createdAt, title: note.body, meta: `Note · ${note.authorName}` });
  }
  for (const lease of detail.leases) {
    if (lease.noticeGivenAt) {
      events.push({
        at: lease.noticeGivenAt,
        title: `Notice given: ${unitLabel(lease)}`,
        meta: lease.moveOutDate ? `Move-out ${formatDate(lease.moveOutDate)}` : 'Notice to vacate',
      });
    }
  }
  for (const lease of detail.leases) {
    const label = unitLabel(lease);
    events.push({
      at: lease.createdAt,
      title: `Lease drafted: ${label}`,
      meta: LEASE_LABEL[lease.status],
    });
    if (lease.status !== 'DRAFT') {
      events.push({ at: lease.startDate, title: `Move-in: ${label}`, meta: 'Lease start date' });
    }
    if (lease.status === 'ENDED' || lease.status === 'TERMINATED') {
      events.push({
        at: lease.endDate,
        title: `Move-out: ${label}`,
        meta: LEASE_LABEL[lease.status],
      });
    }
    if (lease.signedAt) {
      events.push({ at: lease.signedAt, title: 'Lease signed', meta: label });
    }
    // Payments are listed once, in Payment history; this feed keeps notes and lease milestones.
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 12);
}

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function PropertyCourtIcon() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 35V11h10V5h10v6h10v24M3 35h34M11 17h4M25 17h4M11 24h4M25 24h4M18 35V23h4v12" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14 3H5v18h14V8zM14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireManagerRole();
  const { id } = await params;
  const raw = await searchParams;
  const detail = await organizationTenants(session.organizationId).detail(id);
  if (!detail) notFound();

  const { tenant, leases, currentLease } = detail;
  const editing = raw.edit === '1';
  const returnTo = tenantReturnHref(raw.returnTo);
  const profileHref = `/tenants/${tenant.id}?${new URLSearchParams({ returnTo })}`;
  const error = typeof raw.error === 'string' ? raw.error : undefined;
  const noteAdded = raw.note === '1';
  const allPayments = leases
    .flatMap((lease) => lease.payments.map((payment) => ({ payment, lease })))
    .sort((a, b) => b.payment.createdAt.getTime() - a.payment.createdAt.getTime());
  const payPage = pageFrom(
    typeof raw.payPage === 'string' ? raw.payPage : undefined,
    allPayments.length,
  );
  const payments = paginate(allPayments, payPage);
  const draftLease = leases.find((l) => l.status === 'DRAFT');
  const activeLease = leases.find((l) => l.status === 'ACTIVE');
  const firstMoveIn = leases
    .filter((l) => l.status === 'ACTIVE' || l.status === 'ENDED' || l.status === 'TERMINATED')
    .map((l) => l.startDate)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const docLeases = leases.filter((l) => l.documents.length > 0);
  const documentCount = docLeases.reduce((count, lease) => count + lease.documents.length, 0);
  const autopayOn = currentLease
    ? (await db.autopaySetting.count({
        where: {
          organizationId: session.organizationId,
          leaseId: currentLease.id,
          tenantId: tenant.id,
          enabled: true,
        },
      })) > 0
    : false;
  const events = history(detail);

  return (
    <div className={styles.scope}>
      <Link className={styles.backLink} href={returnTo}>
        ← Back to tenants
      </Link>
      <PageHeader
        eyebrow="People / Tenant"
        title={tenant.name}
        actions={[
          { label: 'Edit profile', href: `${profileHref}&edit=1#edit-profile` },
          ...(currentLease ? [{ label: 'View lease', href: `/leases/${currentLease.id}` }] : []),
          activeLease
            ? { label: 'Renew lease', href: `/leases/new?renew=${activeLease.id}`, primary: true }
            : !draftLease
              ? { label: 'Create lease', href: `/leases/new?tenant=${tenant.id}`, primary: true }
              : { label: 'View draft lease', href: `/leases/${draftLease.id}`, primary: true },
        ]}
      />

      {error && <Alert tone="error">{error}</Alert>}

      {editing && (
        <EditTenantForm
          tenant={{
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone,
            emergencyContactName: tenant.emergencyContactName,
            emergencyContactPhone: tenant.emergencyContactPhone,
            emergencyContactRelationship: tenant.emergencyContactRelationship,
          }}
          action={updateTenantAction.bind(null, tenant.id)}
          cancelHref={profileHref}
          returnTo={returnTo}
        />
      )}

      <section className={styles.profileBand} aria-label="Tenant overview">
        <span className={cx('avatar', styles.profileAvatar)}>{initials(tenant.name)}</span>
        <div>
          <div className={styles.actions}>
            <Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
            {activeLease?.noticeGivenAt && <Badge tone="warning">Notice given</Badge>}
            {autopayOn && <Badge tone="info">Autopay on</Badge>}
          </div>
          <p>
            {currentLease ? (
              <>
                <Link href={`/properties/${currentLease.unit.property.id}`}>
                  {currentLease.unit.property.name}
                </Link>
                {!currentLease.unit.isImplicit && (
                  <>
                    {' '}
                    ·{' '}
                    <Link
                      href={`/properties/${currentLease.unit.property.id}?unit=${encodeURIComponent(currentLease.unitId)}`}
                    >
                      Unit {currentLease.unit.number}
                    </Link>
                  </>
                )}
                {firstMoveIn && (
                  <>
                    <br />
                    Tenant since {formatDate(firstMoveIn)}
                  </>
                )}
              </>
            ) : (
              'Not assigned to a unit'
            )}
          </p>
        </div>
        <div className={styles.balance}>
          <p className={styles.meta}>Outstanding balance</p>
          <strong className={detail.balanceCents > 0 ? styles.dangerText : undefined}>
            {formatMoney(detail.balanceCents / 100)}
          </strong>
        </div>
      </section>

      <nav className={styles.sectionNav} aria-label="Tenant profile sections">
        <a href="#contact">Contact</a>
        <a href="#lease-summary">Lease summary</a>
        <a href="#payment-history">Payments</a>
        <a href="#tenant-documents">Documents</a>
        <a href="#move-dates">Move-in / move-out</a>
        <a href="#tenant-history">Notes and history</a>
      </nav>

      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <Card id="lease-summary" className={styles.pad}>
            <div className={styles.sectionHead}>
              <h2>Lease summary</h2>
              {currentLease && (
                <Link className={styles.link} href={`/leases/${currentLease.id}`}>
                  View lease <ArrowRight />
                </Link>
              )}
            </div>
            {currentLease ? (
              <>
                <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
                  <Link className={styles.person} href={`/leases/${currentLease.id}`}>
                    <span className={styles.fileIcon}>
                      <PropertyCourtIcon />
                    </span>
                    <span>
                      <strong>{unitLabel(currentLease)}</strong>
                      <small>
                        {tenant.name} ·{' '}
                        {currentLease.unit.property.type === 'MULTI_UNIT'
                          ? 'Multi-unit'
                          : 'Single-unit'}
                      </small>
                    </span>
                  </Link>
                  <Badge tone={currentLease.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {LEASE_LABEL[currentLease.status]}
                  </Badge>
                </div>
                <div className={styles.rent}>
                  <div>
                    <p className={styles.meta}>Monthly rent</p>
                    <strong>{formatMoney(currentLease.monthlyRent)}</strong>
                  </div>
                  <div>
                    <p className={styles.meta}>Security deposit</p>
                    <strong>{formatMoney(currentLease.deposit)}</strong>
                  </div>
                </div>
                <dl className={styles.kv}>
                  <dt>Property</dt>
                  <dd>
                    <Link href={`/properties/${currentLease.unit.property.id}`}>
                      {currentLease.unit.property.name}
                    </Link>
                  </dd>
                  {!currentLease.unit.isImplicit && (
                    <>
                      <dt>Unit</dt>
                      <dd>
                        <Link
                          href={`/properties/${currentLease.unit.property.id}?unit=${encodeURIComponent(currentLease.unitId)}`}
                        >
                          Unit {currentLease.unit.number}
                        </Link>
                      </dd>
                    </>
                  )}
                  <dt>Term</dt>
                  <dd>
                    <Link href={`/leases/${currentLease.id}`}>
                      {formatDate(currentLease.startDate)} – {formatDate(currentLease.endDate)}
                    </Link>
                  </dd>
                  <dt>Occupants</dt>
                  <dd>{currentLease.occupants ?? '—'}</dd>
                  {currentLease.noticeGivenAt && (
                    <>
                      <dt>Notice</dt>
                      <dd>
                        <strong>Notice given</strong> {formatDate(currentLease.noticeGivenAt)}
                        {currentLease.moveOutDate && (
                          <> · move-out {formatDate(currentLease.moveOutDate)}</>
                        )}
                      </dd>
                    </>
                  )}
                  <dt>Co-tenants</dt>
                  <dd>
                    {currentLease.tenants.filter((t) => t.tenantId !== tenant.id).length
                      ? currentLease.tenants
                          .filter((t) => t.tenantId !== tenant.id)
                          .map((t, index) => (
                            <span key={t.tenantId}>
                              {index > 0 && ', '}
                              <Link
                                href={`/tenants/${t.tenantId}?${new URLSearchParams({ returnTo })}`}
                              >
                                {t.tenant.name}
                              </Link>
                            </span>
                          ))
                      : 'None'}
                  </dd>
                </dl>
              </>
            ) : (
              <p className={styles.muted}>
                No lease yet. Create a lease to assign a unit and record the rental terms.
              </p>
            )}
          </Card>

          <Card flush id="payment-history" className={styles.tableCard}>
            <div className={styles.pad}>
              <div className={styles.sectionHead} style={{ marginBottom: 0 }}>
                <h2>Payment history</h2>
                <Link
                  className={styles.link}
                  href={
                    currentLease
                      ? `/properties/${currentLease.unit.property.id}/payments?unit=${encodeURIComponent(currentLease.unitId)}`
                      : '/payments'
                  }
                >
                  Open ledger <ArrowRight />
                </Link>
              </div>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Lease / reference</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className={styles.muted}>
                      No payments recorded.
                    </td>
                  </tr>
                )}
                {payments.map(({ payment, lease }) => (
                  <tr key={payment.id}>
                    <th scope="row">{formatDate(payment.paidAt ?? payment.createdAt)}</th>
                    <td data-label="Lease / reference">
                      <span>
                        <Link href={`/leases/${lease.id}`}>{unitLabel(lease)}</Link>
                        <small>{describePaymentReference(payment.providerReference)}</small>
                      </span>
                    </td>
                    <td data-label="Amount" className={styles.num}>
                      {formatMoney(payment.amount)}
                    </td>
                    <td data-label="Status">
                      <Badge tone={PAYMENT_TONE[payment.status]}>
                        {PAYMENT_LABEL[payment.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TenantPager
              page={payPage}
              total={allPayments.length}
              noun="payments"
              href={(p) => `${profileHref}&payPage=${p}#payment-history`}
            />
          </Card>

          <Card id="tenant-documents" className={cx(styles.pad, styles.stack)}>
            <div className={styles.sectionHead}>
              <h2>Documents</h2>
              <span className={styles.meta}>
                {documentCount} {documentCount === 1 ? 'file' : 'files'}
              </span>
            </div>
            {docLeases.length === 0 && (
              <p className={styles.muted}>No documents on this tenant’s leases.</p>
            )}
            {docLeases.map((lease) => (
              <section key={lease.id} aria-label={`Documents for ${unitLabel(lease)}`}>
                <Link className={styles.meta} href={`/leases/${lease.id}`}>
                  Lease: {unitLabel(lease)} ({formatDate(lease.startDate)} –{' '}
                  {formatDate(lease.endDate)})
                </Link>
                {lease.documents.map((doc) => (
                  <div className={styles.file} key={doc.id}>
                    <span className={styles.fileIcon}>
                      <DocumentIcon />
                    </span>
                    <div>
                      <strong>{doc.name}</strong>
                      <small>
                        {doc.kind.toLowerCase()} · {formatDate(doc.createdAt)} ·{' '}
                        {formatBytes(doc.sizeBytes)}
                      </small>
                    </div>
                    <div className={styles.actions}>
                      <Button href={`/api/files/${doc.id}/preview`} variant="secondary" size="sm">
                        Preview
                      </Button>
                      <Button href={`/api/files/${doc.id}/download`} variant="secondary" size="sm">
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </Card>
        </div>

        <div className={styles.stack}>
          <Card id="contact" className={cx(styles.pad, styles.contact)}>
            <div className={styles.sectionHead}>
              <h2>Contact</h2>
            </div>
            <dl className={styles.kv}>
              <dt>Email</dt>
              <dd>
                {tenant.email ? (
                  <a href={`mailto:${tenant.email}`}>{tenant.email}</a>
                ) : (
                  <span className={styles.muted}>No email on file</span>
                )}
              </dd>
              <dt>Phone</dt>
              <dd>
                {tenant.phone ? (
                  <a href={`tel:${tenant.phone}`}>{tenant.phone}</a>
                ) : (
                  <span className={styles.muted}>No phone on file</span>
                )}
              </dd>
              <dt>Emergency</dt>
              <dd>
                {tenant.emergencyContactName ? (
                  <>
                    {tenant.emergencyContactName}
                    {tenant.emergencyContactRelationship && (
                      <span className={styles.muted}> ({tenant.emergencyContactRelationship})</span>
                    )}
                    {tenant.emergencyContactPhone && (
                      <>
                        <br />
                        <a href={`tel:${tenant.emergencyContactPhone}`}>
                          {tenant.emergencyContactPhone}
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
          </Card>

          <Card id="move-dates" className={cx(styles.pad, styles.stack)}>
            <h2>Move-in / move-out</h2>
            {draftLease && (
              <>
                <Alert>
                  Lease for {unitLabel(draftLease)} is drafted for{' '}
                  {formatDate(draftLease.startDate)}.
                </Alert>
                <form action={moveInAction.bind(null, tenant.id)}>
                  <input type="hidden" name="leaseId" value={draftLease.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Button type="submit" variant="primary" block>
                    Move in
                  </Button>
                </form>
              </>
            )}
            {activeLease && (
              <>
                <Alert tone="success">
                  Moved in {formatDate(activeLease.startDate)} · {unitLabel(activeLease)}.
                </Alert>
                <MoveOutDialog
                  tenantName={tenant.name}
                  unitLabel={unitLabel(activeLease)}
                  leaseId={activeLease.id}
                  returnTo={returnTo}
                  action={moveOutAction.bind(null, tenant.id)}
                />
              </>
            )}
            {!draftLease && !activeLease && (
              <p className={styles.muted}>
                {leases.length
                  ? 'This tenant has moved out.'
                  : 'Add a unit to this tenant to move them in.'}
              </p>
            )}
          </Card>

          <Card id="tenant-history" className={styles.pad}>
            <div className={styles.sectionHead}>
              <h2>Notes and history</h2>
            </div>
            {noteAdded && <Alert tone="success">Note added.</Alert>}
            <AddNoteForm action={addNoteAction.bind(null, tenant.id)} returnTo={returnTo} />
            <ol className={styles.timeline}>
              {events.map((event, i) => (
                <li key={i}>
                  <strong>{event.title}</strong>
                  <small>
                    {formatDate(event.at)} · {event.meta}
                  </small>
                </li>
              ))}
            </ol>
            {events.length === 0 && <p className={styles.muted}>No activity yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
