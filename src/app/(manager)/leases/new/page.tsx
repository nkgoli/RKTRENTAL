import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card, CardHeader } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { dateInput, nextLeaseStart, renewalEnd } from '@/lib/leases/core';
import { leaseName } from '@/lib/leases/format';
import { leasesDb } from '@/lib/leases/queries';
import { unitLabel } from '@/lib/properties/format';
import { NewLeaseForm } from '../LeaseForms';

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ renew?: string }>;
}) {
  const session = await requireManagerRole();
  const { renew: renewId } = await searchParams;
  const data = leasesDb(session.organizationId);
  const [options, source] = await Promise.all([
    data.formOptions(),
    renewId ? data.detail(renewId) : Promise.resolve(null),
  ]);
  if (renewId && (!source || source.status !== 'ACTIVE')) notFound();
  const today = new Date();
  const start = source
    ? nextLeaseStart(source.endDate)
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = renewalEnd(start);
  const values = {
    startDate: dateInput(start),
    endDate: dateInput(end),
    monthlyRent: source ? source.monthlyRent.toString() : '',
    deposit: source ? source.deposit.toString() : '',
    lateFee: source ? source.lateFee.toString() : '0',
    graceDays: source?.graceDays ?? 0,
  };
  return (
    <>
      <PageHeader title={source ? 'Renew lease' : 'Create lease'} eyebrow="Leasing" />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/leases">Leases</Link> / {source ? 'Renew lease' : 'Create lease'}
      </nav>
      <div className="split">
        <Card>
          <CardHeader title={source ? 'Renewal terms' : 'Set the terms'} />
          {source && (
            <p className="muted" style={{ marginBottom: 16 }}>
              Create a draft renewal for {leaseName(source)} at{' '}
              {unitLabel(source.unit.property, source.unit)}.
            </p>
          )}
          <NewLeaseForm
            units={options.units.map((u) => ({ id: u.id, label: unitLabel(u.property, u) }))}
            tenants={options.tenants.map((t) => ({ id: t.id, name: t.name }))}
            renewId={renewId}
            values={values}
          />
        </Card>
        <Card>
          <CardHeader title="Lease summary" />
          <p className="muted">
            Each lease covers one unit. A single-unit home uses its whole-property unit.
          </p>
          <p className="muted" style={{ marginTop: 12 }}>
            An active lease cannot overlap another active lease for the same unit.
          </p>
        </Card>
      </div>
    </>
  );
}
