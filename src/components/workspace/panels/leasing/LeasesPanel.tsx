import Link from 'next/link';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RowMenu } from '@/components/ui/RowMenu';
import { NoticeToast } from '@/components/ui/Toast';
import { DeleteDraftButton } from '@/components/lease-create/DeleteDraftButton';
import { draftNotice } from '@/components/lease-create/draft-notice';
import { draftRenewalSources } from '@/lib/lease-create/delete-draft';
import { Pagination, pageFrom, paginate } from '@/components/ui/Pagination';
import { leaseName, signLabel, statusLabel, term } from '@/lib/leases/format';
import { leasesDb, type LeaseListItem } from '@/lib/leases/queries';
import { formatMoney, initials } from '@/lib/properties/format';
import { scopeQuery, type ScopeFilter } from '@/lib/workspace/scope';
import { withUnit } from './scope';
import styles from './leasing.module.css';
import ux from './leases-ux.module.css';

type Section = {
  key: 'current' | 'drafts' | 'past';
  title: string;
  leases: LeaseListItem[];
  empty: string;
};

function LeaseCard({
  lease,
  showUnit,
  scope,
  renewal = false,
}: {
  lease: LeaseListItem;
  showUnit: boolean;
  scope: ScopeFilter;
  renewal?: boolean;
}) {
  const name = leaseName(lease);
  const unit = lease.unit.isImplicit ? 'Whole property' : `Unit ${lease.unit.number}`;
  const context = new URLSearchParams({ propertyId: lease.unit.property.id });
  if (scope.unitId) context.set('unitId', scope.unitId);
  const href = `/leases/${lease.id}?${context}`;
  const setupContext = new URLSearchParams(context);
  setupContext.set('property', lease.unit.property.id);
  if (scope.unitId) setupContext.set('unit', scope.unitId);
  return (
    <li className={`${styles.leaseCard} row-link`} data-lease={lease.id}>
      <Avatar initials={initials(name)} size="sm" />
      <div className={styles.leaseMain}>
        <strong>
          <Link
            className="row-anchor"
            href={
              lease.status === 'DRAFT'
                ? `/leases/new?${setupContext}&draft=${encodeURIComponent(lease.id)}`
                : href
            }
          >
            {name}
          </Link>
        </strong>
        <small>
          {showUnit && `${unit} · `}
          {term(lease.startDate, lease.endDate)} · {formatMoney(Number(lease.monthlyRent))}/mo
        </small>
      </div>
      <div className={styles.leaseStatus}>
        <Badge tone={lease.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {statusLabel(lease.status)}
        </Badge>
        {lease.status === 'ACTIVE' && lease.eSignStatus !== 'SIGNED' && (
          <small className="muted">{signLabel(lease.eSignStatus)}</small>
        )}
      </div>
      <div className={styles.leaseActions}>
        {lease.status === 'DRAFT' ? (
          <Button
            href={`/leases/new?${setupContext}&draft=${encodeURIComponent(lease.id)}`}
            size="sm"
            variant="primary"
          >
            Continue setup
          </Button>
        ) : null}
        {lease.status === 'DRAFT' && lease.eSignStatus === 'NOT_SENT' && (
          <DeleteDraftButton
            leaseId={lease.id}
            placeLabel={`${lease.unit.property.name}${lease.unit.isImplicit ? '' : ` · Unit ${lease.unit.number}`}`}
            tenantName={lease.tenants.length ? name : undefined}
            renewal={renewal}
            returnTo={scope.unitId ? 'unit' : 'property'}
            text="Delete"
          />
        )}
        {lease.status === 'ACTIVE' &&
          (lease.endDate >= new Date() && lease.endDate.getTime() - Date.now() <= 90 * 86400000 ? (
            <Button
              href={`/leases/new?${setupContext}&renew=${encodeURIComponent(lease.id)}`}
              size="sm"
              variant="ghost"
            >
              Renew
            </Button>
          ) : (
            <RowMenu label={`More actions for ${name}`}>
              <Link href={`/leases/new?${setupContext}&renew=${encodeURIComponent(lease.id)}`}>
                Prepare renewal
              </Link>
            </RowMenu>
          ))}
      </div>
    </li>
  );
}

/** Leases for one property (and optionally one unit) as Current, Drafts and Past; cards open the lease detail page. */
export async function LeasesPanel({
  organizationId,
  scope,
  page,
  notice,
}: {
  organizationId: string;
  scope: ScopeFilter;
  page?: string;
  /** `?notice=` from the URL; draft deletion leaves one here. */
  notice?: string;
}) {
  const { leases } = await leasesDb(organizationId).list(scope);
  const renewals = await draftRenewalSources(
    organizationId,
    leases.filter((l) => l.status === 'DRAFT').map((l) => l.id),
  );
  const toast = draftNotice(notice);
  const setupContext = scopeQuery(scope);
  if (scope.propertyId) setupContext.set('property', scope.propertyId);
  if (scope.unitId) setupContext.set('unit', scope.unitId);
  const newLease = `/leases/new?${setupContext}`;
  const byStart = (a: LeaseListItem, b: LeaseListItem) =>
    b.startDate.getTime() - a.startDate.getTime();
  const sections: Section[] = [
    {
      key: 'current',
      title: 'Current',
      leases: leases.filter((l) => l.status === 'ACTIVE').sort(byStart),
      empty: 'No current lease.',
    },
    {
      key: 'drafts',
      title: 'Drafts',
      leases: leases.filter((l) => l.status === 'DRAFT').sort(byStart),
      empty: 'No drafts in progress.',
    },
    {
      key: 'past',
      title: 'Past',
      leases: leases.filter((l) => l.status === 'ENDED' || l.status === 'TERMINATED').sort(byStart),
      empty: 'No past leases.',
    },
  ];
  const showUnit = !scope.unitId;
  // Past leases pile up over the years; page them like every other long list.
  const past = sections[2].leases;
  const pastPage = pageFrom(page, past.length);
  const pastHref = (n: number) =>
    withUnit(
      `/properties/${scope.propertyId}/leases`,
      scope.unitId,
      n > 1 ? { page: String(n) } : {},
    );

  return (
    <section className={`${styles.panel} ${ux.panel}`} aria-label="Leases">
      {toast && <NoticeToast message={toast} tone="success" />}
      <div className={styles.pageHeader}>
        <div>
          <h2>Leases</h2>
          <p className="muted">
            {leases.length === 0
              ? 'Start with a lease for this property or unit.'
              : `${leases.length} lease${leases.length === 1 ? '' : 's'} for ${scope.unitId ? 'this unit' : 'this property'}. Continue a draft or review an agreement below.`}
          </p>
        </div>
        <div className={ux.actions}>
          <Button href="/leases/templates" variant="ghost" size="sm">
            Lease templates
          </Button>
          <Button href={newLease} variant="primary" size="sm">
            Set up lease
          </Button>
        </div>
      </div>
      {leases.length === 0 && (
        <div className={`card ${styles.emptyCard}`}>
          <strong>No leases yet</strong>
          <p className="muted">
            Choose the unit, add tenants and review the agreement. You can save a draft before
            sending.
          </p>
        </div>
      )}
      {leases.length > 0 &&
        sections.map((section) => (
          <div
            key={section.key}
            className={styles.leaseSection}
            aria-label={`${section.title} leases`}
          >
            <h3>
              {section.title} <span className="muted">{section.leases.length}</span>
            </h3>
            {section.leases.length === 0 ? (
              <p className={styles.sectionEmpty}>{section.empty}</p>
            ) : (
              <div className="card flush">
                <ul className={styles.leaseList}>
                  {(section.key === 'past' ? paginate(past, pastPage) : section.leases).map(
                    (lease) => (
                      <LeaseCard
                        key={lease.id}
                        lease={lease}
                        showUnit={showUnit}
                        scope={scope}
                        renewal={renewals.has(lease.id)}
                      />
                    ),
                  )}
                </ul>
                {section.key === 'past' && (
                  <Pagination
                    page={pastPage}
                    total={past.length}
                    noun="past leases"
                    href={pastHref}
                  />
                )}
              </div>
            )}
          </div>
        ))}
    </section>
  );
}
