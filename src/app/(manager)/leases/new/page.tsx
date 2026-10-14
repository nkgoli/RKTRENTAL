import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireManagerRole } from '@/lib/auth/access';
import { dateInput } from '@/lib/leases/core';
import { leaseName } from '@/lib/leases/format';
import { leasesDb } from '@/lib/leases/queries';
import { unitLabel } from '@/lib/properties/format';
import { emptyDraft } from '@/lib/lease-create/types';
import { renewalDefaults } from '@/lib/lease-create/service';
import { LeaseCreateWizard } from './LeaseCreateWizard';

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
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const initialDraft = source
    ? renewalDefaults(source)
    : emptyDraft({ startDate: dateInput(todayUtc) });
  if (!source) {
    const start = todayUtc;
    const end = new Date(
      Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1),
    );
    initialDraft.endDate = dateInput(end);
  }

  return (
    <>
      <PageHeader title={source ? 'Renew lease' : 'Create lease'} eyebrow="Leasing" />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/leases">Leases</Link> / {source ? 'Renew lease' : 'Create lease'}
      </nav>
      <div style={{ marginBottom: 16 }}>
        <p className="eyebrow">{source ? 'Renewal' : 'New residential lease'}</p>
        <h2 style={{ fontSize: 22 }}>{source ? 'Renew this lease' : 'Set the terms'}</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          {source
            ? 'Confirm the renewal dates, rent and clauses before sending for e-signature.'
            : 'Work through the steps, save a draft at any point, then send the lease for e-signature.'}
        </p>
      </div>
      <LeaseCreateWizard
        units={options.units.map((u) => ({
          id: u.id,
          label: unitLabel(u.property, u),
          status: u.status,
          listedRent: u.listedRent?.toString() ?? null,
        }))}
        tenants={options.tenants.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
        renewId={renewId}
        initialDraft={initialDraft}
        sourceLabel={
          source
            ? `${leaseName(source)} · ${unitLabel(source.unit.property, source.unit)}`
            : undefined
        }
        renewalSourceEnd={source ? dateInput(source.endDate) : null}
      />
    </>
  );
}
