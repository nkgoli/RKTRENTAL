import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/shell/Icons';
import { Card, NoticeToast, Progress, SearchField, Table, TableHead } from '@/components/ui';
import { SummaryBand } from '@/components/ui/SummaryBand';
import { MiniCover } from '@/components/dashboard/MiniCover';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb, propertyFilterFrom, type PropertyFilter } from '@/lib/properties/data';
import { formatAddress, formatMoney } from '@/lib/properties/format';
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
  searchParams: Promise<{
    q?: string;
    filter?: string;
    view?: string;
    add?: string;
    notice?: string;
  }>;
}) {
  const session = await requireManagerRole();
  const { q, filter: filterParam, view: viewParam, add, notice } = await searchParams;
  const view: View = viewParam === 'list' ? 'list' : 'grid';
  const filter = propertyFilterFrom(filterParam);
  const createHref = `/properties/new?returnTo=${encodeURIComponent(href(filter, q, view))}`;
  if (add === '1') redirect(createHref);
  const data = propertiesDb(session.organizationId);
  const [{ properties, totals }, counts] = await Promise.all([
    data.listProperties({ q, filter }),
    data.countByFilter(),
  ]);
  const occupancy = totals.units ? Math.round((totals.occupied / totals.units) * 100) : 0;

  return (
    <>
      {notice === 'property-archived' && <NoticeToast message="Property archived" />}
      <PageHeader
        title="Properties"
        eyebrow="Portfolio"
        meta={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'} · ${totals.units} ${totals.units === 1 ? 'unit' : 'units'}`}
        actions={[
          {
            label: 'Add property',
            icon: 'plus',
            href: createHref,
            primary: true,
          },
        ]}
      />
      <SummaryBand
        label="Properties in this view"
        eyebrow="Portfolio occupancy"
        value={`${occupancy}%`}
        detail={`${totals.occupied} of ${totals.units} units occupied across ${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
        progress={{
          label: `${totals.occupied} of ${totals.units} units occupied`,
          value: occupancy,
          tone: 'accent',
        }}
        stats={[
          {
            label: 'Total units',
            value: totals.units,
            detail: `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`,
          },
          { label: 'Occupied', value: totals.occupied, detail: `${occupancy}% occupancy` },
          {
            label: 'Vacant',
            value: totals.vacant,
            detail: totals.vacant ? 'Ready to list or turn over' : 'Fully occupied',
          },
        ]}
      />
      <section className={styles.toolbar}>
        <SearchField defaultValue={q} placeholder="Search by name or address" />
        <nav className={styles.filters} aria-label="Property filters">
          {FILTERS.map(({ key, label }) => {
            const count =
              key === 'all' || key === 'multi' || key === 'single' || key === 'archived'
                ? counts[key]
                : undefined;
            return (
              <Link
                scroll={false}
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
        {properties.length > 0 && (q || filter !== 'all') && (
          <Link href="/properties" scroll={false}>
            Clear filters
          </Link>
        )}
      </section>

      <section className={styles.viewBar}>
        <span className="muted">
          {properties.length} {properties.length === 1 ? 'property' : 'properties'}
          {q || filter !== 'all' ? ' in this view' : ''}
        </span>
        <div className={styles.viewToggle} role="group" aria-label="View">
          {(['grid', 'list'] as const).map((v) => (
            <Link
              scroll={false}
              key={v}
              href={href(filter, q, v)}
              aria-current={v === view ? 'true' : undefined}
              className={v === view ? styles.viewActive : undefined}
            >
              {v === 'grid' ? 'Grid' : 'List'}
            </Link>
          ))}
        </div>
      </section>

      {properties.length === 0 && (
        <section className={styles.empty}>
          <Icon name="properties" />
          <h2>{q || filter !== 'all' ? 'No properties match this view' : 'No properties yet'}</h2>
          <p>
            {q || filter !== 'all'
              ? 'Clear the filters to see your full portfolio.'
              : 'Add your first property to start tracking units and leases.'}
          </p>
          <a
            className="btn btn-secondary"
            href={q || filter !== 'all' ? '/properties' : createHref}
          >
            {q || filter !== 'all' ? 'Clear filters' : 'Add a property'}
          </a>
        </section>
      )}

      {properties.length > 0 && (
        <section
          className={`${styles.grid} ${view === 'list' ? styles.mobileGrid : ''}`}
          aria-label="Property directory"
        >
          {properties.map((p) => {
            const single = p.type === 'SINGLE_UNIT';
            const occ = occupancyOf(p);
            return (
              <Link
                key={p.id}
                className={`card flush ${styles.propertyCard}`}
                href={`/properties/${p.id}`}
              >
                <div
                  className={`${styles.cover} ${!single && p.unitCount >= 12 ? styles.teal : ''}`}
                  aria-hidden="true"
                >
                  <Icon name={single ? 'rent-analysis' : 'properties'} />
                  {p.coverPhotoId && (
                    <span
                      className={styles.coverPhoto}
                      style={{
                        backgroundImage: `url("/api/files/${encodeURIComponent(p.coverPhotoId)}/preview")`,
                      }}
                    />
                  )}
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
        <Card flush className={styles.desktopList}>
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
                          <MiniCover
                            cover={{
                              type: p.type,
                              unitCount: p.unitCount,
                              coverPhotoId: p.coverPhotoId,
                            }}
                          />
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
    </>
  );
}
