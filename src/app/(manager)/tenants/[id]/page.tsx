import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  Badge,
  Button,
  Card,
  FileRow,
  Pagination,
  pageFrom,
  paginate,
  Table,
  TableHead,
} from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { describePaymentReference } from '@/lib/ledger';
import { formatBytes, formatDate, formatMoney } from '@/lib/tenants/format';
import { organizationTenants, type TenantDetail } from '@/lib/tenants/queries';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/tenants/status';
import { addNoteAction, moveInAction, moveOutAction, updateTenantAction } from '../actions';
import { AddNoteForm, EditTenantForm } from '../TenantForms';
import { tenantReturnHref } from '../navigation';
import styles from '../tenants.module.css';

function ProfileHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="card-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

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

  return (
    <div className={styles.profile}>
      <Link className={styles.backLink} href={returnTo}>
        ← Back to tenants
      </Link>
      <PageHeader
        eyebrow="Tenants"
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

      {error && (
        <div className="alert warning" role="alert">
          {error}
        </div>
      )}

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

      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
        {activeLease?.noticeGivenAt && <Badge tone="warning">Notice given</Badge>}
        {autopayOn && <Badge tone="info">Autopay on</Badge>}
        {detail.balanceCents > 0 && (
          <Badge tone="danger">{formatMoney(detail.balanceCents / 100)} due</Badge>
        )}
        <span className={`muted ${styles.profileContext}`}>
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
              {firstMoveIn && <> · Tenant since {formatDate(firstMoveIn)}</>}
            </>
          ) : (
            'Not assigned to a unit'
          )}
        </span>
      </div>

      <nav className={styles.sectionLinks} aria-label="Tenant profile sections">
        <a href="#contact">Contact</a>
        <a href="#lease-summary">Lease summary</a>
        <a href="#payment-history">Payments</a>
        <a href="#tenant-documents">Documents</a>
        <a href="#move-dates">Move-in / move-out</a>
        <a href="#tenant-history">Notes and history</a>
      </nav>
      <div className={styles.profileLayout}>
        <div className={styles.profileMain}>
          <Card id="lease-summary">
            <ProfileHeader
              title="Lease summary"
              action={
                currentLease && (
                  <Button href={`/leases/${currentLease.id}`} variant="ghost" size="sm">
                    View lease
                  </Button>
                )
              }
            />
            {currentLease ? (
              <dl className="kv">
                <dt>Lease</dt>
                <dd>
                  <Link href={`/leases/${currentLease.id}`}>
                    {unitLabel(currentLease)} — {tenant.name}
                  </Link>{' '}
                  <Badge tone={currentLease.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {LEASE_LABEL[currentLease.status]}
                  </Badge>
                </dd>
                <dt>Property</dt>
                <dd>
                  <Link href={`/properties/${currentLease.unit.property.id}`}>
                    {currentLease.unit.property.name}
                  </Link>{' '}
                  <span className="muted">
                    (
                    {currentLease.unit.property.type === 'MULTI_UNIT'
                      ? 'multi-unit'
                      : 'single-unit'}
                    )
                  </span>
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
                <dt>Monthly rent</dt>
                <dd>{formatMoney(currentLease.monthlyRent)}</dd>
                <dt>Security deposit</dt>
                <dd>{formatMoney(currentLease.deposit)}</dd>
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
            ) : (
              <p className="muted">
                No lease yet. Create a lease to assign a unit and record the rental terms.
              </p>
            )}
          </Card>

          <Card flush id="payment-history" className={styles.paymentCard}>
            <ProfileHeader
              title="Payment history"
              action={
                <Button
                  href={
                    currentLease
                      ? `/properties/${currentLease.unit.property.id}/payments?unit=${encodeURIComponent(currentLease.unitId)}`
                      : '/payments'
                  }
                  variant="ghost"
                  size="sm"
                >
                  Open ledger
                </Button>
              }
            />
            <Table>
              <TableHead
                columns={[
                  'Date',
                  'Lease',
                  'Reference',
                  <span key="a" className="num" style={{ display: 'block' }}>
                    Amount
                  </span>,
                  'Status',
                ]}
              />
              <tbody>
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No payments recorded.
                    </td>
                  </tr>
                )}
                {payments.map(({ payment, lease }) => (
                  <tr key={payment.id}>
                    <td data-label="Date">{formatDate(payment.paidAt ?? payment.createdAt)}</td>
                    <td data-label="Lease">
                      <Link href={`/leases/${lease.id}`}>{unitLabel(lease)}</Link>
                    </td>
                    <td data-label="Reference" className="muted">
                      {describePaymentReference(payment.providerReference)}
                    </td>
                    <td data-label="Amount" className="num">
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
            </Table>
            <Pagination
              page={payPage}
              total={allPayments.length}
              noun="payments"
              href={(p) => `${profileHref}&payPage=${p}#payment-history`}
            />
          </Card>

          <Card id="tenant-documents">
            <ProfileHeader title="Documents" />
            {docLeases.length === 0 && (
              <p className="muted">No documents on this tenant’s leases.</p>
            )}
            {docLeases.map((lease) => (
              <section key={lease.id} aria-label={`Documents for ${unitLabel(lease)}`}>
                <p
                  className="muted"
                  style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 4px' }}
                >
                  <Link href={`/leases/${lease.id}`}>
                    Lease: {unitLabel(lease)} ({formatDate(lease.startDate)} –{' '}
                    {formatDate(lease.endDate)})
                  </Link>
                </p>
                {lease.documents.map((doc) => (
                  <FileRow
                    key={doc.id}
                    kind={
                      doc.mimeType === 'application/pdf'
                        ? 'pdf'
                        : doc.mimeType.startsWith('image/')
                          ? 'img'
                          : 'doc'
                    }
                    name={doc.name}
                    meta={`${doc.kind.toLowerCase()} · ${formatDate(doc.createdAt)} · ${formatBytes(doc.sizeBytes)}`}
                    action={
                      <>
                        <Button href={`/api/files/${doc.id}/preview`} variant="ghost" size="sm">
                          Preview
                        </Button>
                        <Button
                          href={`/api/files/${doc.id}/download`}
                          variant="secondary"
                          size="sm"
                        >
                          Download
                        </Button>
                      </>
                    }
                  />
                ))}
              </section>
            ))}
          </Card>
        </div>

        <div className={styles.profileSide}>
          <Card id="contact" className={styles.contactCard}>
            <ProfileHeader title="Contact" />
            <dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}>
              <dt>Email</dt>
              <dd>
                {tenant.email ? (
                  <a href={`mailto:${tenant.email}`}>{tenant.email}</a>
                ) : (
                  <span className="muted">No email on file</span>
                )}
              </dd>
              <dt>Phone</dt>
              <dd>
                {tenant.phone ? (
                  <a href={`tel:${tenant.phone}`}>{tenant.phone}</a>
                ) : (
                  <span className="muted">No phone on file</span>
                )}
              </dd>
              <dt>Emergency</dt>
              <dd>
                {tenant.emergencyContactName ? (
                  <>
                    {tenant.emergencyContactName}
                    {tenant.emergencyContactRelationship && (
                      <span className="muted"> ({tenant.emergencyContactRelationship})</span>
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

          <Card id="move-dates">
            <ProfileHeader title="Move-in / move-out" />
            <div className="stack">
              {draftLease && (
                <>
                  <div className="alert">
                    Lease for {unitLabel(draftLease)} is drafted for{' '}
                    {formatDate(draftLease.startDate)}.
                  </div>
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
                  <div className="alert success">
                    Moved in {formatDate(activeLease.startDate)} · {unitLabel(activeLease)}.
                  </div>
                  <form action={moveOutAction.bind(null, tenant.id)}>
                    <input type="hidden" name="leaseId" value={activeLease.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Button type="submit" variant="danger" block>
                      Move out
                    </Button>
                  </form>
                </>
              )}
              {!draftLease && !activeLease && (
                <p className="muted">
                  {leases.length
                    ? 'This tenant has moved out.'
                    : 'Add a unit to this tenant to move them in.'}
                </p>
              )}
            </div>
          </Card>

          <Card id="tenant-history">
            <ProfileHeader title="Notes and history" />
            <AddNoteForm action={addNoteAction.bind(null, tenant.id)} />
            {history(detail).map((event, i) => (
              <div className="list-item" key={i}>
                <div className="file-meta">
                  <strong>{event.title}</strong>
                  <small>
                    {formatDate(event.at)} · {event.meta}
                  </small>
                </div>
              </div>
            ))}
            {history(detail).length === 0 && <p className="muted">No activity yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
