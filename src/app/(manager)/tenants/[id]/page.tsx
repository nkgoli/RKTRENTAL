import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  FileRow,
  Table,
  TableHead,
} from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { formatBytes, formatDate, formatMoney, initials } from '@/lib/tenants/format';
import { organizationTenants, type TenantDetail } from '@/lib/tenants/queries';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/tenants/status';
import { moveInAction, moveOutAction, updateTenantAction } from '../actions';
import { EditTenantForm } from '../TenantForms';

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
    for (const p of lease.payments) {
      events.push({
        at: p.paidAt ?? p.createdAt,
        title: `Payment ${PAYMENT_LABEL[p.status].toLowerCase()} ${formatMoney(p.amount)}`,
        meta: label,
      });
    }
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
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
  const error = typeof raw.error === 'string' ? raw.error : undefined;
  const payments = leases
    .flatMap((lease) => lease.payments.map((payment) => ({ payment, lease })))
    .sort((a, b) => b.payment.createdAt.getTime() - a.payment.createdAt.getTime());
  const draftLease = leases.find((l) => l.status === 'DRAFT');
  const activeLease = leases.find((l) => l.status === 'ACTIVE');
  const firstMoveIn = leases
    .filter((l) => l.status === 'ACTIVE' || l.status === 'ENDED' || l.status === 'TERMINATED')
    .map((l) => l.startDate)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const docLeases = leases.filter((l) => l.documents.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Tenants"
        title={tenant.name}
        actions={[
          { label: 'Edit profile', href: `/tenants/${tenant.id}?edit=1` },
          ...(currentLease
            ? [{ label: 'View lease', href: `/leases/${currentLease.id}`, primary: true }]
            : []),
        ]}
      />

      <p className="breadcrumbs">
        <Link href="/tenants">Tenants</Link> / {tenant.name}
      </p>

      {error && (
        <div className="alert warning" role="alert">
          {error}
        </div>
      )}

      {editing && (
        <EditTenantForm
          tenant={tenant}
          action={updateTenantAction.bind(null, tenant.id)}
          cancelHref={`/tenants/${tenant.id}`}
        />
      )}

      <div className="hero">
        <div className="row" style={{ gap: 20 }}>
          <Avatar initials={initials(tenant.name)} size="lg" />
          <div>
            <h2>{tenant.name}</h2>
            <p>
              {currentLease ? (
                <>
                  <Link href={`/properties/${currentLease.unit.property.id}`}>
                    {currentLease.unit.property.name}
                  </Link>
                  {!currentLease.unit.isImplicit && <> · Unit {currentLease.unit.number}</>}
                  {firstMoveIn && <> · Tenant since {formatDate(firstMoveIn)}</>}
                </>
              ) : (
                'Not assigned to a unit'
              )}
            </p>
          </div>
        </div>
        <div className="row">
          <Badge tone={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
          {detail.balanceCents > 0 && (
            <Badge tone="danger">{formatMoney(detail.balanceCents / 100)} due</Badge>
          )}
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <Card>
            <CardHeader
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
                    <dd>Unit {currentLease.unit.number}</dd>
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
                <dt>Co-tenants</dt>
                <dd>
                  {currentLease.tenants.filter((t) => t.tenantId !== tenant.id).length
                    ? currentLease.tenants
                        .filter((t) => t.tenantId !== tenant.id)
                        .map((t) => t.tenant.name)
                        .join(', ')
                    : 'None'}
                </dd>
              </dl>
            ) : (
              <p className="muted">No lease yet. Create one from the Leases page.</p>
            )}
          </Card>

          <Card flush>
            <CardHeader
              title="Payment history"
              action={
                <Button href="/payments" variant="ghost" size="sm">
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
                    <td>{formatDate(payment.paidAt ?? payment.createdAt)}</td>
                    <td>
                      <Link href={`/leases/${lease.id}`}>{unitLabel(lease)}</Link>
                    </td>
                    <td className="muted">{payment.providerReference ?? 'Manual'}</td>
                    <td className="num">{formatMoney(payment.amount)}</td>
                    <td>
                      <Badge tone={PAYMENT_TONE[payment.status]}>
                        {PAYMENT_LABEL[payment.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Documents" />
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

        <div className="stack">
          <Card>
            <CardHeader title="Contact" />
            <dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}>
              <dt>Email</dt>
              <dd>{tenant.email ?? '—'}</dd>
              <dt>Phone</dt>
              <dd>{tenant.phone ?? '—'}</dd>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Move-in / move-out" />
            <div className="stack">
              {draftLease && (
                <>
                  <div className="alert">
                    Lease for {unitLabel(draftLease)} is drafted for{' '}
                    {formatDate(draftLease.startDate)}.
                  </div>
                  <form action={moveInAction.bind(null, tenant.id)}>
                    <input type="hidden" name="leaseId" value={draftLease.id} />
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

          <Card>
            <CardHeader title="Notes and history" />
            {history(detail).map((event, i) => (
              <div className="list-item" key={i}>
                <Avatar initials="•" size="sm" />
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
    </>
  );
}
