import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Badge, Card, Chip, Chips, Progress, Stat } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb, propertyFilterFrom, type PropertyFilter } from '@/lib/properties/data';
import { formatAddress, formatMoney } from '@/lib/properties/format';
import { AddPropertyForm } from './_components/PropertyForm';
import { PhotoImage } from './_components/Media';

const FILTERS: { key: PropertyFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'multi', label: 'Multi-unit' },
  { key: 'single', label: 'Single-unit' },
  { key: 'vacancies', label: 'Has vacancies' },
  { key: 'archived', label: 'Archived' },
];

function href(filter: PropertyFilter, q?: string) {
  const params = new URLSearchParams();
  if (filter !== 'all') params.set('filter', filter);
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `/properties?${qs}` : '/properties';
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const session = await requireManagerRole();
  const { q, filter: filterParam } = await searchParams;
  const filter = propertyFilterFrom(filterParam);
  const data = propertiesDb(session.organizationId);
  const [{ properties, totals }, counts, owners] = await Promise.all([
    data.listProperties({ q, filter }),
    data.countByFilter(),
    data.listOwners(),
  ]);
  const occupancy = totals.units ? Math.round((totals.occupied / totals.units) * 100) : 0;

  return (
    <>
      <PageHeader
        actions={[{ label: '+ Add property', href: '/properties#add-property', primary: true }]}
      />
      <section className="toolbar">
        <form role="search" action="/properties" method="get" style={{ display: 'contents' }}>
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name or address"
              aria-label="Search by name or address"
            />
          </label>
        </form>
        <Chips>
          {FILTERS.map(({ key, label }) => {
            const count =
              key === 'all' || key === 'multi' || key === 'single' || key === 'archived'
                ? counts[key]
                : undefined;
            return (
              <Link key={key} href={href(key, q)} style={{ display: 'contents' }}>
                <Chip active={key === filter}>{count == null ? label : `${label} ${count}`}</Chip>
              </Link>
            );
          })}
        </Chips>
      </section>

      <section className="grid-3">
        <Stat
          label="Total units"
          value={totals.units}
          delta={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
          tone="up"
        />
        <Stat
          label="Occupied"
          value={totals.occupied}
          delta={`${occupancy}% occupancy`}
          tone="up"
        />
        <Stat
          label="Vacant"
          value={totals.vacant}
          delta={totals.vacant ? 'Ready to list or turn over' : 'Fully occupied'}
          tone={totals.vacant ? 'down' : 'up'}
        />
      </section>

      <section className="grid-3">
        {properties.length === 0 && (
          <Card style={{ gridColumn: 'span 3' }}>
            <p className="muted">
              {filter === 'archived'
                ? 'No archived properties.'
                : q || filter !== 'all'
                  ? 'No properties match this search.'
                  : 'No properties yet. Add your first property below.'}
            </p>
          </Card>
        )}
        {properties.map((p) => {
          const single = p.type === 'SINGLE_UNIT';
          const full = p.vacant === 0 && p.unitCount > 0;
          return (
            <Link
              key={p.id}
              className="card flush"
              href={`/properties/${p.id}`}
              style={{ color: 'var(--design-text)' }}
            >
              {p.coverPhotoId ? (
                <PhotoImage
                  photo={{
                    id: p.coverPhotoId,
                    name: p.name,
                    mimeType: 'image/*',
                    sizeBytes: 0,
                    createdAt: new Date(0),
                  }}
                  wide
                  style={{ borderRadius: 0 }}
                />
              ) : (
                <div className="photo wide" style={{ borderRadius: 0 }}>
                  <span className="caption">{p.name}</span>
                </div>
              )}
              <div style={{ padding: 20 }}>
                <div className="row between">
                  <h3>{p.name}</h3>
                  {p.archived ? (
                    <Badge>Archived</Badge>
                  ) : single ? (
                    <Badge tone={full ? 'success' : 'info'}>{full ? 'Occupied' : 'Vacant'}</Badge>
                  ) : (
                    <Badge tone={full ? 'success' : 'warning'}>
                      {p.occupied} / {p.unitCount} occupied
                    </Badge>
                  )}
                </div>
                <p className="muted" style={{ margin: '4px 0 12px' }}>
                  {formatAddress(p)}
                </p>
                <Progress value={p.unitCount ? (p.occupied / p.unitCount) * 100 : 0} />
                <div className="row between muted" style={{ fontSize: 13, marginTop: 10 }}>
                  <span>
                    {single
                      ? 'Single-unit'
                      : `Multi-unit · ${p.unitCount} ${p.unitCount === 1 ? 'unit' : 'units'}`}
                  </span>
                  <span>{formatMoney(p.monthlyRent)} / mo</span>
                </div>
              </div>
            </Link>
          );
        })}
        <AddPropertyForm owners={owners} />
      </section>
    </>
  );
}
