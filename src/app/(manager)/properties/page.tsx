import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { Card, Cover, Progress, Stat, Table, TableHead } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb, propertyFilterFrom, type PropertyFilter } from '@/lib/properties/data';
import { formatAddress, formatMoney } from '@/lib/properties/format';
import { AddPropertyDialog } from './_components/AddPropertyDialog';
import { EmptyState } from '@/components/RouteStates';
import styles from './properties.module.css';

const FILTERS: { key: PropertyFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'multi', label: 'Multi-unit' },
  { key: 'single', label: 'Single-unit' },
  { key: 'vacancies', label: 'Has vacancies' },
  { key: 'archived', label: 'Archived' },
];

type View = 'grid' | 'list';

type Row = { type: string; archived: boolean; unitCount: number; occupied: number; vacant: number };

/** One occupancy indicator per property: label, fill % (multi-unit only) and whether to flag vacancy. */
function occupancyOf(p: Row): { label: string; pct?: number; warm: boolean } {
  if (p.archived) return { label: 'Archived', warm: true };
  const full = p.vacant === 0 && p.unitCount > 0;
  if (p.type === 'SINGLE_UNIT') return { label: full ? 'Occupied' : 'Vacant', warm: !full };
  if (p.unitCount === 0) return { label: 'No units yet', warm: true };
  return {
    label: `${p.occupied}/${p.unitCount} occupied`,
    pct: Math.round((p.occupied / p.unitCount) * 100),
    warm: !full,
  };
}

const typeLabel = (p: Row) =>
  p.type === 'SINGLE_UNIT'
    ? 'Single-family'
    : `${p.unitCount} ${p.unitCount === 1 ? 'unit' : 'units'}`;

function href(filter: PropertyFilter, q?: string, view?: View) {
  const params = new URLSearchParams();
  if (view === 'list') params.set('view', 'list');
  if (filter !== 'all') params.set('filter', filter);
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `/properties?${qs}` : '/properties';
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; view?: string }>;
}) {
  const session = await requireManagerRole();
  const { q, filter: filterParam, view: viewParam } = await searchParams;
  const view: View = viewParam === 'list' ? 'list' : 'grid';
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
        title="Properties"
        eyebrow="Portfolio / Properties"
        actions={[
          {
            label: '+ Add property',
            href: `${href(filter, q, view)}${href(filter, q, view).includes('?') ? '&' : '?'}add=1`,
            primary: true,
          },
        ]}
      />
      <section className={styles.metrics} aria-label="Properties in this view">
        <div className={styles.metric}>
          <span className={styles.metricIcon}>
            <Icon name="properties" />
          </span>
          <Stat
            label="Total units"
            value={totals.units}
            delta={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
            tone="up"
          />
        </div>
        <div className={styles.metric}>
          <span className={`${styles.metricIcon} ${styles.teal}`}>
            <Icon name="tenants" />
          </span>
          <Stat
            label="Occupied"
            value={totals.occupied}
            delta={`${occupancy}% occupancy`}
            tone="up"
          />
        </div>
        <div className={styles.metric}>
          <span className={styles.metricIcon}>
            <Icon name="properties" />
          </span>
          <Stat
            label="Vacant"
            value={totals.vacant}
            delta={totals.vacant ? 'Ready to list or turn over' : 'Fully occupied'}
            tone={totals.vacant ? 'down' : 'up'}
          />
        </div>
      </section>

      <section className={styles.toolbar}>
        <form role="search" action="/properties" method="get" className={styles.searchForm}>
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          {view === 'list' && <input type="hidden" name="view" value="list" />}
          <label className={styles.searchLabel}>
            Search properties
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by name or address"
              aria-label="Search by name or address"
            />
          </label>
          <button className="btn btn-secondary btn-sm" type="submit">
            Search
          </button>
        </form>
        <nav className={styles.filters} aria-label="Property filters">
          {FILTERS.map(({ key, label }) => {
            const count =
              key === 'all' || key === 'multi' || key === 'single' || key === 'archived'
                ? counts[key]
                : undefined;
            return (
              <Link
                key={key}
                href={href(key, q, view)}
                aria-current={key === filter ? 'page' : undefined}
                className={styles.filterLink}
              >
                {label}
                {count != null && (
                  <>
                    {' '}
                    <span className={styles.count}>{count}</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </section>

      <section className={styles.viewBar}>
        <span className="muted">
          {properties.length} {properties.length === 1 ? 'property' : 'properties'}
          {q || filter !== 'all' ? ' in this view' : ''}
        </span>
        <div className={styles.viewToggle} role="group" aria-label="View">
          {(['grid', 'list'] as const).map((v) => (
            <Link
              key={v}
              href={href(filter, q, v)}
              aria-current={v === view ? 'true' : undefined}
              className={v === view ? styles.viewActive : undefined}
              scroll={false}
            >
              {v === 'grid' ? 'Grid' : 'List'}
            </Link>
          ))}
        </div>
      </section>

      {properties.length === 0 && (
        <EmptyState
          title={q || filter !== 'all' ? 'No properties match this view' : 'No properties yet'}
          description={
            q || filter !== 'all'
              ? 'Clear the filters to see your full portfolio.'
              : 'Add your first property to start tracking units and leases.'
          }
          action={q || filter !== 'all' ? 'Clear filters' : 'Add a property'}
          href={q || filter !== 'all' ? '/properties' : '/properties?add=1'}
        />
      )}

      {properties.length > 0 && view === 'grid' && (
        <section className={styles.grid} aria-label="Property directory">
          {properties.map((p) => {
            const single = p.type === 'SINGLE_UNIT';
            const occ = occupancyOf(p);
            return (
              <Link
                key={p.id}
                className={`card flush ${styles.propertyCard}`}
                href={`/properties/${p.id}`}
              >
                <div className={styles.cover}>
                  <Cover
                    kind={single ? 'house' : 'apartment'}
                    src={p.coverPhotoId ? `/api/files/${p.coverPhotoId}/preview` : undefined}
                  />
                </div>
                <div className={styles.details}>
                  <h3 className={styles.name} title={p.name}>
                    {p.name}
                  </h3>
                  <span className={styles.address}>{formatAddress(p)}</span>
                  <div className={styles.propertyMeta}>
                    <span>{typeLabel(p)}</span>
                    <span className={styles.rent}>
                      <strong>{formatMoney(p.monthlyRent)}</strong>
                      <small>/ mo</small>
                    </span>
                  </div>
                  <div className={`${styles.occupancy} ${occ.warm ? styles.warm : ''}`}>
                    <span>{occ.label}</span>
                    {occ.pct != null && <Progress value={occ.pct} label={`${p.name} occupancy`} />}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {properties.length > 0 && view === 'list' && (
        <Card flush>
          <div
            className={styles.tableWrap}
            role="region"
            aria-label="Property directory table; scroll horizontally on phone"
            tabIndex={0}
          >
            <Table aria-label="Properties">
              <caption>Properties · {properties.length} properties · monthly rent in USD</caption>
              <TableHead
                columns={['Property', 'Address', 'Type', 'Units', 'Occupancy', 'Monthly rent']}
              />
              <tbody>
                {properties.map((p) => {
                  const occ = occupancyOf(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link className={styles.rowLink} href={`/properties/${p.id}`}>
                          {p.name}
                        </Link>
                      </td>
                      <td>{formatAddress(p)}</td>
                      <td>{p.type === 'SINGLE_UNIT' ? 'Single-family' : 'Multi-unit'}</td>
                      <td>{p.unitCount}</td>
                      <td className={occ.warm ? styles.warm : undefined}>{occ.label}</td>
                      <td>{formatMoney(p.monthlyRent)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      <AddPropertyDialog owners={owners} />
    </>
  );
}
