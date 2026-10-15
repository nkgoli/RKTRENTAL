import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { PageHeader } from '@/components/shell/PageHeader';
import { KpiIcon } from '@/components/ui';
import styles from './lease-create.module.css';
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
  searchParams: Promise<{ renew?: string; unit?: string; applicant?: string; tenant?: string }>;
}) {
  const session = await requireManagerRole();
  const {
    renew: renewId,
    unit: unitParam,
    applicant: applicantId,
    tenant: tenantParam,
  } = await searchParams;
  const applicant = applicantId
    ? await db.application.findFirst({
        where: { id: applicantId, organizationId: session.organizationId },
      })
    : null;
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

  const applicantTenant = applicant
    ? options.tenants.find((t) => t.email?.toLowerCase() === applicant.applicantEmail.toLowerCase())
    : undefined;
  const requestedUnitId = unitParam ?? applicant?.unitId;
  const requestedUnit = requestedUnitId
    ? options.units.find((u) => u.id === requestedUnitId)
    : undefined;
  if (!source && requestedUnit) {
    initialDraft.unitId = requestedUnit.id;
    initialDraft.monthlyRent = requestedUnit.listedRent?.toString() ?? '';
    initialDraft.deposit = initialDraft.monthlyRent;
  }
  const preselectedTenant =
    applicantTenant ??
    (tenantParam ? options.tenants.find((t) => t.id === tenantParam) : undefined);
  if (!source && preselectedTenant) {
    initialDraft.tenantIds = [preselectedTenant.id];
    initialDraft.primaryTenantId = preselectedTenant.id;
  }

  return (
    <>
      <PageHeader title={source ? 'Renew lease' : 'Create lease'} eyebrow="Leasing" />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/leases">Leases</Link> / {source ? 'Renew lease' : 'Create lease'}
      </nav>
      <div className={styles.intro}>
        <p className="eyebrow">{source ? 'Renewal' : 'New residential lease'}</p>
        <div className={styles.introLine}>
          <KpiIcon>✎</KpiIcon>
          <h2>{source ? 'Renew this lease' : 'Set the terms'}</h2>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          {source
            ? 'Confirm the renewal dates, rent and clauses before sending for e-signature.'
            : 'Work through the steps, save a draft at any point, then send the lease for e-signature.'}
        </p>
      </div>
      {applicant && (
        <div className={applicantTenant ? 'alert' : 'alert warning'} role="status">
          {applicantTenant ? (
            <>
              Prefilled from the approved application for {applicant.applicantName}. Review the unit
              and terms below.
            </>
          ) : (
            <>
              {applicant.applicantName} ({applicant.applicantEmail}) isn’t a tenant yet.{' '}
              <Link href="/tenants#add-tenant">Add them as a tenant</Link>, then return here to
              select them.
            </>
          )}
        </div>
      )}
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
