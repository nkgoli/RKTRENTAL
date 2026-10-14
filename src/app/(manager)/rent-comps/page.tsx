import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Alert, Badge, Card } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { parseFilters } from '@/lib/comps/core';
import { compsSettings, fetchComps, listPricingUnits, subjectFacts } from '@/lib/comps/service';
import {
  bedBath,
  formatAddress,
  formatDate,
  formatMoney,
  unitLabel,
} from '@/lib/properties/format';
import { refreshCompsAction } from './actions';
import { CompsWorkbench } from './CompsWorkbench';
import { FilterBar, UnitPicker } from './FilterBar';
import { EmptyState } from '@/components/RouteStates';

type Search = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const statusLabel = { OCCUPIED: 'Occupied', VACANT: 'Vacant', TURNOVER: 'Turnover' } as const;

export default async function RentCompsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireManagerRole();
  const query = await searchParams;
  const params = Object.fromEntries(Object.keys(query).map((key) => [key, first(query[key])]));

  const units = await listPricingUnits(session.organizationId);
  const unit = units.find((candidate) => candidate.id === params.unit) ?? units[0];
  const header = (
    <PageHeader
      title="Rent comps"
      eyebrow="Pricing"
      actions={[
        { label: 'Data source settings', href: '/integrations' },
        {
          label: 'Use for renewal',
          href: unit ? `/leases/new?unit=${unit.id}` : '/leases/new',
          primary: true,
        },
      ]}
    />
  );
  if (!unit)
    return (
      <>
        {header}
        <EmptyState title="No units to compare yet" description="Add a property and unit to compare it with nearby rentals." action="Go to properties" href="/properties" />
      </>
    );

  const settings = await compsSettings(session.organizationId);
  const subject = subjectFacts(unit, settings.radiusMiles);
  const filters = parseFilters(params, subject);
  const label = unitLabel(unit.property, unit);
  const listedRent = unit.listedRent === null ? null : Number(unit.listedRent);
  const marketRent = unit.marketRent === null ? null : Number(unit.marketRent);

  let result: Awaited<ReturnType<typeof fetchComps>> | null = null;
  let failure: string | null = null;
  try {
    result = await fetchComps(session.organizationId, unit.id, subject, filters);
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Comps could not be loaded.';
  }

  const status = statusLabel[unit.status as keyof typeof statusLabel];
  const appliedNote =
    unit.marketRentSetAt && unit.marketRentSetByName
      ? `Market rent set by ${unit.marketRentSetByName} on ${formatDate(unit.marketRentSetAt)}.`
      : null;

  return (
    <>
      {header}
      <Card>
        <div className="row between">
          <div className="row">
            <div className="photo" style={{ width: 120 }} />
            <div>
              <p className="eyebrow">Subject unit</p>
              <h3 style={{ fontSize: 20 }}>{label}</h3>
              <p className="muted">
                {formatAddress(unit.property)} ·{' '}
                {bedBath({ bedrooms: unit.bedrooms, bathrooms: subject.bathrooms })}
                {unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString('en-US')} sqft` : ''}
              </p>
            </div>
          </div>
          <div className="row" style={{ gap: 24 }}>
            <div>
              <p className="muted">Status</p>
              <Badge tone={unit.status === 'VACANT' ? 'warning' : 'info'}>
                {status ?? 'Archived'}
              </Badge>
            </div>
            <div>
              <p className="muted">Listed at</p>
              <strong style={{ fontSize: 20 }}>{formatMoney(listedRent)}</strong>
              {listedRent !== null && unit.squareFeet ? (
                <p className="muted">${(listedRent / unit.squareFeet).toFixed(2)} / sqft</p>
              ) : null}
            </div>
            <UnitPicker
              unitId={unit.id}
              units={units.map((candidate) => ({
                id: candidate.id,
                label: `${unitLabel(candidate.property, candidate)}${candidate.status === 'VACANT' ? ' (vacant)' : ''}`,
              }))}
            />
          </div>
        </div>
      </Card>

      <Card>
        <FilterBar unitId={unit.id} filters={filters} />
      </Card>

      {failure || !result ? (
        <Alert tone="warning">
          <div>
            <strong>Comps unavailable</strong>
            <br />
            {failure} Check the rent comps provider in{' '}
            <Link href="/integrations">Integrations</Link>.
          </div>
        </Alert>
      ) : (
        <>
          <form action={refreshCompsAction} className="row" style={{ justifyContent: 'flex-end' }}>
            <input type="hidden" name="unitId" value={unit.id} />
            <button className="btn btn-ghost btn-sm">Refresh comps</button>
          </form>
          <CompsWorkbench
            // A new unit or filter set remounts so exclusions and the apply form start fresh.
            key={`${unit.id}:${JSON.stringify(filters)}:${result.fetchedAt.getTime()}`}
            unitId={unit.id}
            unitLabel={label}
            rows={result.rows}
            radiusMiles={filters.radiusMiles}
            subjectSqft={unit.squareFeet}
            listedRent={listedRent}
            marketRent={marketRent}
            providerName={result.providerName}
            syncedAt={
              result.fetchedAt.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'UTC',
              }) + ' UTC'
            }
            cached={result.cached}
            appliedNote={appliedNote}
          />
        </>
      )}
    </>
  );
}
