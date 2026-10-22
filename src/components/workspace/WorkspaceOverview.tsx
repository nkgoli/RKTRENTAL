import Link from 'next/link';
import {
  Action,
  ActionGlyph,
  Badge,
  Card,
  CardHeader,
  Pagination,
  pageFrom,
  paginate,
} from '@/components/ui';
import { SummaryBand, type SummaryStat } from '@/components/ui/SummaryBand';
import { bedBath, formatDate, formatMoney } from '@/lib/properties/format';
import type { OverviewSignals, PropertyDetail, UnitDetail } from '@/lib/properties/data';
import { ArchiveButton } from '@/app/(manager)/properties/_components/PropertyForm';
import { DeleteUnitControl } from '@/components/units/DeleteUnitControl';
import { daysBetween, type Timeline } from '@/lib/workspace/timeline';
import type { PaymentsMonth } from '@/lib/workspace/timeline-data';
import { PropertyFactsCard, UnitFactsCard } from './InlineFacts';
import { LeaseTimeline } from './LeaseTimeline';
import { AddUnitDialog } from '@/app/(manager)/properties/_components/AddUnitDialog';
import {
  RENEWAL_DUE_DAYS,
  activeUnits,
  expiringDetail,
  firstExpiring,
  leaseTerm,
  occupancyDetail,
  paymentsView,
  splitUnitsForPhone,
  timeLeft,
  unitName,
  unitStatusView,
  type OverviewUnit,
} from './overview-model';
import styles from './WorkspaceOverview.module.css';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const applicantStatus: Record<string, string> = {
  SUBMITTED: 'submitted',
  SCREENING: 'in screening',
  REVIEW: 'in review',
};

function Arrow() {
  return <span aria-hidden="true"> →</span>;
}

/**
 * "Payments this month" summary band (Designs/redisgn): collected figure, due/outstanding detail,
 * an accessible meter and the overdue/reminder actions, with inset stats beside it.
 */
export function PaymentsSummary({
  payments,
  href,
  reminderHref,
  today = new Date(),
  stats,
}: {
  payments?: PaymentsMonth;
  href: string;
  reminderHref: string;
  today?: Date;
  stats?: SummaryStat[];
}) {
  const view = payments ? paymentsView(payments, today) : null;
  return (
    <SummaryBand
      label="Payments this month"
      eyebrow={view?.eyebrow ?? 'Payments this month'}
      value={view?.value ?? '—'}
      detail={view?.detail ?? 'Payment figures are not available right now.'}
      progress={
        view && payments?.hasCharges
          ? { label: view.meter, value: view.percent, valueText: `${view.percent}% collected` }
          : undefined
      }
      stats={stats}
      footer={
        <>
          <Link className="btn btn-secondary btn-sm" href={href}>
            View payments
            <ActionGlyph name="arrow-right" />
          </Link>
          {view && !payments?.hasCharges && <span className="muted">{view.meter}</span>}
          {view && view.overdueCents > 0 && (
            <span className={styles.overdue}>
              <strong className="danger">{formatMoney(view.overdueCents / 100)} overdue</strong>
              <small>Total to date; includes older arrears and assessed fees</small>
            </span>
          )}
          <span className="action-group">
            {view && view.overdueCents > 0 && (
              <Action
                icon="bell"
                text="Send reminder"
                label="Send payment reminder"
                tone="secondary"
                href={reminderHref}
              />
            )}
            <Action icon="history" label="Reminder history" href={`${reminderHref}&view=history`} />
          </span>
        </>
      }
    />
  );
}

export type NextStep = {
  eyebrow: string;
  tone: 'danger' | 'primary' | 'accent';
  heading: string;
  detail?: string;
  linkLabel: string;
  href: string;
  /** Full-document navigation (the Returns & ROI report). */
  document?: boolean;
};

function NextSteps({ steps, className }: { steps: NextStep[]; className?: string }) {
  return (
    <Card className={`${styles.nextSteps} ${className ?? ''}`} aria-labelledby="next-steps-title">
      <h3 className={styles.panelTitle} id="next-steps-title">
        <span className={styles.bell}>
          <ActionGlyph name="bell" />
        </span>
        Next steps
      </h3>
      {steps.length ? (
        <ul className={styles.steps}>
          {steps.map((step) => (
            <li key={step.eyebrow}>
              <p className={`eyebrow ${styles[step.tone]}`}>{step.eyebrow}</p>
              <h4>{step.heading}</h4>
              {step.detail && <p className={styles.stepDetail}>{step.detail}</p>}
              <Link className={styles.stepLink} href={step.href}>
                {step.linkLabel}
                <Arrow />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.clearState}>
          <p>All caught up</p>
          <small>No urgent items need attention.</small>
        </div>
      )}
    </Card>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** The unit's active lease term, from the unit record or the timeline's current segment. */
function termOf(unit: OverviewUnit, timeline?: Timeline) {
  const current = timeline?.rows
    .find((row) => row.unitId === unit.id)
    ?.segments.find((segment) => segment.kind === 'current');
  const start = unit.leaseStart ?? current?.start ?? null;
  const end = unit.leaseEnd ?? current?.end ?? null;
  return { start, end };
}

function Configuration({ unit, href }: { unit: PropertyDetail['units'][number]; href: string }) {
  return (
    <>
      {unit.bedrooms == null && unit.bathrooms == null ? (
        <Link href={href}>Add details</Link>
      ) : (
        bedBath(unit)
      )}
      {unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString('en-US')} sqft` : ''}
    </>
  );
}

type UnitRowView = {
  unit: PropertyDetail['units'][number];
  href: string;
  rent: string;
  term: string;
  left: string;
  status: ReturnType<typeof unitStatusView>;
  applicants: string | null;
};

function PhoneUnitRow({ row, today }: { row: UnitRowView; today: Date }) {
  const { unit } = row;
  const days = unit.leaseEnd ? daysBetween(today, unit.leaseEnd) : null;
  const renewal = row.status.label === 'Renewal due' && days != null;
  return (
    <li className={styles.phoneRow}>
      <div>
        <p className={styles.phoneTitle}>
          <Link href={row.href}>{unit.isImplicit ? 'Whole property' : unit.number}</Link>
          <span aria-hidden="true"> · </span>
          {unit.tenant ? (
            <Link href={`/tenants/${unit.tenant.id}`}>{unit.tenant.name}</Link>
          ) : (
            <span>No tenant</span>
          )}
        </p>
        <p className={styles.caption}>
          {row.rent}
          {unit.tenant && unit.leaseEnd
            ? ` · ends ${formatDate(unit.leaseEnd)}`
            : row.applicants
              ? ` · ${row.applicants}`
              : ''}
        </p>
      </div>
      <Badge tone={row.status.tone}>
        {renewal ? (days! <= 0 ? 'Ends today' : plural(days!, 'day')) : row.status.label}
      </Badge>
    </li>
  );
}

function PropertyUnits({
  property,
  page: pageParam,
  timeline,
  signals,
  today,
}: {
  property: PropertyDetail;
  page?: string;
  timeline?: Timeline;
  signals?: OverviewSignals;
  today: Date;
}) {
  const all = activeUnits(property.units);
  const page = pageFrom(pageParam, all.length);
  const view = (unit: PropertyDetail['units'][number]): UnitRowView => {
    const term = termOf(unit, timeline);
    const vacant = unit.status !== 'OCCUPIED';
    const apps = signals?.applicants[unit.id];
    const applicants = apps
      ? `${plural(apps.count, 'applicant')} · ${applicantStatus[apps.first.status] ?? 'open'}`
      : null;
    return {
      unit,
      href: `/properties/${property.id}?unit=${unit.id}`,
      rent:
        vacant && unit.rent == null
          ? unit.listedRent != null
            ? `${formatMoney(unit.listedRent)} asking`
            : 'No asking rent'
          : formatMoney(unit.rent ?? unit.listedRent),
      term:
        term.start && term.end
          ? leaseTerm(term.start, term.end)
          : vacant
            ? (applicants ?? 'No active lease')
            : 'Current lease',
      left: term.end ? timeLeft(term.end, today) : '—',
      status: unitStatusView({ ...unit, leaseEnd: term.end }, today),
      applicants,
    };
  };
  const rows = paginate(all, page).map(view);
  const { priority, rest } = splitUnitsForPhone(
    all.map((unit) => ({ ...unit, leaseEnd: termOf(unit, timeline).end })),
    today,
  );
  const byId = new Map(all.map((unit) => [unit.id, unit]));
  const phoneTop = (priority.length ? priority : rest.slice(0, 3)).map((u) =>
    view(byId.get(u.id)!),
  );
  const phoneRest = (priority.length ? rest : rest.slice(3)).map((u) => view(byId.get(u.id)!));

  return (
    <Card flush id="units" className={styles.units}>
      <div className={styles.unitsHead}>
        <div>
          <h3>Units &amp; lease terms</h3>
          <p className={styles.caption}>
            {all.length} total · {property.stats.occupied} occupied · as of {formatDate(today)} UTC
          </p>
        </div>
        <div className={styles.unitActions}>
          <Link className={styles.stepLink} href={`/properties/${property.id}/leases`}>
            Lease history
            <Arrow />
          </Link>
          {!property.archived && <AddUnitDialog propertyId={property.id} />}
        </div>
      </div>
      {all.length === 0 && <p className={`muted ${styles.phoneEmpty}`}>No active units yet.</p>}
      {all.length > 0 && (
        <div className={styles.phoneUnits}>
          <ul
            className={styles.phoneList}
            aria-label={priority.length ? 'Units needing attention' : 'Units'}
          >
            {phoneTop.map((row) => (
              <PhoneUnitRow key={row.unit.id} row={row} today={today} />
            ))}
          </ul>
          {phoneRest.length > 0 && (
            <details className={styles.disclosure}>
              <summary>{plural(phoneRest.length, 'more unit')}</summary>
              <ul className={styles.phoneList}>
                {phoneRest.map((row) => (
                  <PhoneUnitRow key={row.unit.id} row={row} today={today} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <div
        className={styles.tableWrap}
        role="region"
        aria-label="Property units table"
        tabIndex={0}
      >
        <table className={`table ${styles.striped}`} aria-label="Property units">
          <thead>
            <tr>
              <th scope="col">Unit</th>
              <th scope="col">Tenant</th>
              <th scope="col" className="num">
                Rent / month
              </th>
              <th scope="col">Lease term</th>
              <th scope="col">Time left</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No active units yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.unit.id}>
                <td>
                  <Link href={row.href} aria-label={`Open unit ${row.unit.number}`}>
                    <strong>{row.unit.isImplicit ? 'Whole property' : row.unit.number}</strong>
                  </Link>
                  <small className={styles.unitConfiguration}>
                    <Configuration unit={row.unit} href={row.href} />
                  </small>
                </td>
                <td>
                  {row.unit.tenant ? (
                    <span className={styles.person}>
                      <span className={styles.personMark} aria-hidden="true">
                        {initials(row.unit.tenant.name)}
                      </span>
                      <Link href={`/tenants/${row.unit.tenant.id}`}>{row.unit.tenant.name}</Link>
                    </span>
                  ) : (
                    <span className="muted">No tenant</span>
                  )}
                </td>
                <td className="num">{row.rent}</td>
                <td className={row.unit.status === 'OCCUPIED' ? undefined : 'muted'}>{row.term}</td>
                <td>{row.left}</td>
                <td>
                  <Badge tone={row.status.tone}>{row.status.label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pagination}>
        <Pagination
          page={page}
          total={all.length}
          noun="units"
          href={(p) => `/properties/${property.id}?unitsPage=${p}#units`}
        />
      </div>
      {timeline && (
        <details className={`${styles.disclosure} ${styles.timelineDisclosure}`}>
          <summary>Lease timeline</summary>
          <LeaseTimeline timeline={timeline} propertyId={property.id} linkUnits />
        </details>
      )}
    </Card>
  );
}

function ArchiveRow({ property }: { property: PropertyDetail }) {
  const title = property.archived ? 'Restore property' : 'Archive property';
  return (
    <section className={styles.archiveRow} aria-label={title}>
      <div>
        <p className={styles.archiveTitle}>{title}</p>
        <p className={styles.caption}>
          {property.archived
            ? `Returns ${property.name} to your active properties. Asks for confirmation first.`
            : `Moves ${property.name} to the Archived filter on Properties. Asks for confirmation first.`}
        </p>
      </div>
      <ArchiveButton
        propertyId={property.id}
        propertyName={property.name}
        archived={property.archived}
        compact
      />
    </section>
  );
}

/** Up to three live next steps: open repairs, expiring leases and vacancy. */
export function propertyNextSteps(
  property: PropertyDetail,
  today: Date,
  signals?: OverviewSignals,
): NextStep[] {
  const base = `/properties/${property.id}`;
  const units = activeUnits(property.units);
  const steps: NextStep[] = [];
  const repairs = property.stats.openRepairs;
  if (repairs) {
    const first = signals?.repairs.first;
    const where = first
      ? `${first.title}${first.unitNumber ? `, Unit ${first.unitNumber}` : ''}`
      : '';
    const urgent = signals?.repairs.urgent ?? 0;
    steps.push({
      eyebrow: 'Maintenance',
      tone: 'danger',
      heading: `${plural(repairs, 'repair')} need${repairs === 1 ? 's' : ''} attention`,
      detail: first ? (urgent ? `${urgent} urgent · ${where}` : where) : undefined,
      linkLabel: 'Open maintenance',
      href: `${base}/maintenance`,
    });
  }
  const expiring = property.stats.expiringLeases;
  if (expiring) {
    const first = firstExpiring(units, today);
    steps.push({
      eyebrow: 'Renewals',
      tone: 'primary',
      heading: `${plural(expiring, 'lease')} expiring soon`,
      detail: first
        ? `${first.tenant?.name ?? 'No tenant'}, ${unitName(first)}, ends ${expiring > 1 ? 'first ' : ''}on ${shortDate(first.leaseEnd)}`
        : undefined,
      linkLabel: 'Review leases',
      href: `${base}/leases`,
    });
  }
  const open = units
    .filter((unit) => unit.status !== 'OCCUPIED')
    .sort((a, b) => Number(b.status === 'VACANT') - Number(a.status === 'VACANT'));
  if (open.length) {
    const unit = open.find((candidate) => signals?.applicants[candidate.id]) ?? open[0];
    const apps = signals?.applicants[unit.id];
    const asking = unit.listedRent != null ? `${formatMoney(unit.listedRent)} asking` : 'vacant';
    const heading =
      open.length === 1 ? `${unitName(unit)} · ${asking}` : `${open.length} units not occupied`;
    const appDetail = apps
      ? `${apps.first.name} applied ${shortDate(apps.first.appliedAt)} · ${applicantStatus[apps.first.status] ?? 'open'}${apps.count > 1 ? ` · ${apps.count - 1} more` : ''}`
      : 'No open applications yet';
    steps.push({
      eyebrow: 'Vacancy',
      tone: 'accent',
      heading,
      detail: open.length === 1 ? appDetail : `${unitName(unit)} · ${asking} · ${appDetail}`,
      ...(apps
        ? {
            linkLabel: 'Review applicants',
            href: `${base}/applications?unit=${encodeURIComponent(unit.id)}`,
          }
        : { linkLabel: 'Review vacant units and pricing', href: `${base}/listing` }),
    });
  }
  return steps;
}

export function PropertyOverview({
  property,
  owners = [],
  timeline,
  payments,
  signals,
  unitsPage,
}: {
  property: PropertyDetail;
  owners?: { id: string; name: string }[];
  timeline?: Timeline;
  payments?: PaymentsMonth;
  signals?: OverviewSignals;
  unitsPage?: string;
}) {
  const today = timeline?.today ?? new Date();
  const live = activeUnits(property.units);
  const units = live.map((unit) => ({ ...unit, leaseEnd: termOf(unit, timeline).end }));
  const multiUnit = live.some((unit) => !unit.isImplicit);
  const occupancyPct = live.length ? Math.round((property.stats.occupied / live.length) * 100) : 0;
  const steps = propertyNextSteps(property, today, signals);
  const hasVacancy = live.some((unit) => unit.status !== 'OCCUPIED');
  const base = `/properties/${property.id}`;

  return (
    <div className={styles.page}>
      <div className={styles.band}>
        <PaymentsSummary
          payments={payments}
          today={today}
          href={`${base}/payments`}
          reminderHref={`/notifications?propertyId=${property.id}`}
          stats={[
            {
              label: 'Occupancy',
              value: `${occupancyPct}%`,
              detail: occupancyDetail(units, property.stats.occupied),
            },
            {
              label: 'Leases expiring soon',
              value: property.stats.expiringLeases,
              detail: expiringDetail(firstExpiring(units, today)),
              href: `${base}/leases`,
            },
          ]}
        />
      </div>
      <NextSteps steps={steps} className={styles.stepsArea} />
      <div className={styles.detailsArea}>
        <PropertyFactsCard
          propertyId={property.id}
          owners={owners}
          ownerName={property.owner?.name ?? 'Not assigned'}
          rentRoll={`${formatMoney(property.stats.monthlyRent)} / month`}
          initial={{
            name: property.name,
            type: property.type,
            street: property.street,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode,
            yearBuilt: property.yearBuilt,
            ownerId: property.owner?.id ?? null,
          }}
          links={
            <>
              {/* Same full-document navigation as the Returns & ROI tab. */}
              <a className={styles.stepLink} href={`${base}/returns`}>
                Returns &amp; ROI
                <Arrow />
              </a>
              <Link className={styles.stepLink} href={`${base}/listing`}>
                {hasVacancy ? 'Review vacant units and pricing' : 'Review unit pricing'}
                <Arrow />
              </Link>
            </>
          }
        />
      </div>
      <div className={styles.unitsArea}>
        {multiUnit ? (
          <PropertyUnits
            property={property}
            page={unitsPage}
            timeline={timeline}
            signals={signals}
            today={today}
          />
        ) : (
          timeline && (
            <Card aria-label="Lease timeline">
              <CardHeader title="Lease timeline" />
              <LeaseTimeline timeline={timeline} propertyId={property.id} />
            </Card>
          )
        )}
      </div>
      <div className={styles.archiveArea}>
        <ArchiveRow property={property} />
      </div>
    </div>
  );
}

function UnitLeaseSummary({ unit, today }: { unit: UnitDetail; today: Date }) {
  const current = unit.currentLease;
  if (!current) {
    return (
      <div className={styles.emptyLease}>
        <strong>No active lease on this unit.</strong>
        <p className="muted">Set up a lease to start collecting rent.</p>
        <Link className="btn btn-primary btn-sm" href={`/leases/new?unit=${unit.id}`}>
          Create lease
        </Link>
      </div>
    );
  }
  return (
    <>
      <dl className={styles.detailsList}>
        <div>
          <dt>Tenant</dt>
          <dd>
            {current.tenant ? (
              <Link href={`/tenants/${current.tenant.id}`}>{current.tenant.name}</Link>
            ) : (
              'Tenant not assigned'
            )}
          </dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{leaseTerm(current.startDate, current.endDate)}</dd>
        </div>
        <div>
          <dt>Time left</dt>
          <dd>{timeLeft(current.endDate, today)}</dd>
        </div>
        <div>
          <dt>Rent</dt>
          <dd>{formatMoney(current.monthlyRent)} / month</dd>
        </div>
        <div>
          <dt>Deposit</dt>
          <dd>{formatMoney(current.deposit)}</dd>
        </div>
      </dl>
      <div className={styles.detailsLinks}>
        <Link
          className={styles.stepLink}
          href={`/leases/${current.id}?propertyId=${unit.property.id}&unitId=${unit.id}`}
          aria-label="View lease"
        >
          View lease
          <Arrow />
        </Link>
      </div>
    </>
  );
}

export function unitNextSteps(
  unit: UnitDetail,
  today: Date,
  signals?: OverviewSignals,
): NextStep[] {
  const base = `/properties/${unit.property.id}`;
  const lease = unit.currentLease;
  const steps: NextStep[] = [];
  if (unit.openRepairs) {
    const first = signals?.repairs.first;
    const urgent = signals?.repairs.urgent ?? 0;
    steps.push({
      eyebrow: 'Maintenance',
      tone: 'danger',
      heading: `${plural(unit.openRepairs, 'open maintenance request')}`,
      detail: first ? (urgent ? `${urgent} urgent · ${first.title}` : first.title) : undefined,
      linkLabel: 'Open maintenance',
      href: `${base}/maintenance?unit=${unit.id}`,
    });
  }
  if (!lease) {
    steps.push({
      eyebrow: 'Lease',
      tone: 'primary',
      heading: 'Create a lease for this unit',
      detail: 'Set up a lease to start collecting rent.',
      linkLabel: 'Create lease',
      href: `/leases/new?unit=${unit.id}`,
    });
  } else if (daysBetween(today, lease.endDate) < RENEWAL_DUE_DAYS) {
    steps.push({
      eyebrow: 'Renewal',
      tone: 'primary',
      heading: `Lease ends ${formatDate(lease.endDate)}`,
      detail: `${lease.tenant?.name ?? 'Tenant'} · ${timeLeft(lease.endDate, today)} left`,
      linkLabel: 'Review lease',
      href: `/leases/${lease.id}?propertyId=${unit.property.id}&unitId=${unit.id}`,
    });
  }
  const rentGap =
    unit.marketRent != null && unit.listedRent != null ? unit.marketRent - unit.listedRent : null;
  if (rentGap != null && rentGap > 0) {
    steps.push({
      eyebrow: 'Pricing',
      tone: 'accent',
      heading: `${formatMoney(rentGap)} below market rent`,
      detail: `Listed ${formatMoney(unit.listedRent)} · market ${formatMoney(unit.marketRent)}`,
      linkLabel: 'Review pricing',
      href: `${base}/listing?unit=${unit.id}`,
    });
  } else if (!lease && signals?.applicants[unit.id]) {
    const apps = signals.applicants[unit.id];
    steps.push({
      eyebrow: 'Vacancy',
      tone: 'accent',
      heading: plural(apps.count, 'applicant'),
      detail: `${apps.first.name} applied ${shortDate(apps.first.appliedAt)} · ${applicantStatus[apps.first.status] ?? 'open'}`,
      linkLabel: 'Review applicants',
      href: `${base}/applications?unit=${unit.id}`,
    });
  }
  return steps;
}

export function UnitOverview({
  unit,
  canDelete,
  timeline,
  payments,
  signals,
}: {
  unit: UnitDetail;
  canDelete: boolean;
  timeline?: Timeline;
  payments?: PaymentsMonth;
  signals?: OverviewSignals;
}) {
  const today = timeline?.today ?? new Date();
  const currentLease = unit.currentLease;
  const base = `/properties/${unit.property.id}`;
  const stats: SummaryStat[] = currentLease
    ? [
        {
          label: 'Lease ends',
          value: timeLeft(currentLease.endDate, today),
          detail: `${formatDate(currentLease.endDate)} · ${currentLease.tenant?.name ?? 'No tenant'}`,
          href: `${base}/leases?unit=${unit.id}`,
        },
        {
          label: 'Rent / month',
          value: formatMoney(currentLease.monthlyRent),
          detail: `Deposit ${formatMoney(currentLease.deposit)}`,
        },
      ]
    : [
        {
          label: 'Asking rent',
          value: formatMoney(unit.listedRent),
          detail:
            unit.marketRent != null ? `Market ${formatMoney(unit.marketRent)}` : 'No active lease',
        },
        {
          label: 'Open repairs',
          value: unit.openRepairs,
          detail: unit.openRepairs ? 'Needs attention' : 'None open',
          href: `${base}/maintenance?unit=${unit.id}`,
        },
      ];

  return (
    <div className={styles.page}>
      <div className={styles.band}>
        <PaymentsSummary
          payments={payments}
          today={today}
          href={`${base}/payments?unit=${unit.id}`}
          reminderHref={`/notifications?propertyId=${unit.property.id}&unitId=${unit.id}`}
          stats={stats}
        />
      </div>
      <NextSteps steps={unitNextSteps(unit, today, signals)} className={styles.stepsArea} />
      <div className={styles.detailsArea}>
        <Card className={styles.detailsPanel} id="lease-terms">
          <CardHeader title="Lease terms" />
          <UnitLeaseSummary unit={unit} today={today} />
        </Card>
      </div>
      <div className={styles.unitsArea}>
        <UnitFactsCard
          propertyId={unit.property.id}
          unitId={unit.id}
          implicit={unit.isImplicit}
          hasActiveLease={!!currentLease}
          initial={{
            number: unit.number,
            status: unit.status,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            squareFeet: unit.squareFeet,
            listedRent: unit.listedRent,
            marketRent: unit.marketRent,
            floor: unit.floor,
            amenities: unit.amenities,
          }}
          footer={
            <DeleteUnitControl
              propertyId={unit.property.id}
              unitId={unit.id}
              unitLabel={unit.number}
              disabled={unit.isImplicit || !canDelete}
              implicit={unit.isImplicit}
            />
          }
        />
      </div>
      {timeline && (
        <div className={styles.archiveArea}>
          <Card>
            <details className={styles.disclosure}>
              <summary>Lease timeline</summary>
              <LeaseTimeline timeline={timeline} propertyId={unit.property.id} />
            </details>
          </Card>
        </div>
      )}
    </div>
  );
}
