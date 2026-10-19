import Link from 'next/link';
import { EmptyState } from '@/components/RouteStates';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination, PAGE_SIZE, pageFrom } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom, unitScopeWhere } from '@/lib/workspace/scope';
import { db } from '@/lib/db/client';
import { requireManagerRole } from '@/lib/auth/access';
import { hasCurrentConsent, type ApplicationStatus } from '@/lib/screening/policy';
import { recordDecision, requestScreening } from './actions';
import { ReviewDecisionForm, ScreeningSubmit } from './ReviewForms';
import { ApplicantList, BackToApplicants } from './ApplicantList';
import { ApplicationArrow } from './ApplicationArrow';
import styles from './applications.module.css';

type SearchParams = {
  applicant?: string;
  notice?: string;
  q?: string;
  status?: string;
  propertyId?: string;
  unitId?: string;
  page?: string;
};
const statuses: ApplicationStatus[] = ['SUBMITTED', 'SCREENING', 'REVIEW', 'APPROVED', 'DECLINED'];
const labels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Awaiting consent',
  SCREENING: 'Screening in progress',
  REVIEW: 'Ready for review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
};
const tones: Record<ApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  SUBMITTED: 'neutral',
  SCREENING: 'warning',
  REVIEW: 'success',
  APPROVED: 'success',
  DECLINED: 'danger',
};
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
function formatDate(value: Date | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}
function objectSummary(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function ApplicationMetric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <div>
        <p>{label}</p>
        <small>{note}</small>
      </div>
    </div>
  );
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [session, params] = await Promise.all([requireManagerRole(), searchParams]);
  const q = params.q?.trim().slice(0, 100) ?? '';
  const status = statuses.includes(params.status as ApplicationStatus)
    ? (params.status as ApplicationStatus)
    : undefined;
  const scope = scopeFilterFrom(params);
  const scopeWhere = unitScopeWhere(scope);
  const where = {
    organizationId: session.organizationId,
    ...scopeWhere,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { applicantName: { contains: q, mode: 'insensitive' as const } },
            { applicantEmail: { contains: q, mode: 'insensitive' as const } },
            { unit: { number: { contains: q, mode: 'insensitive' as const } } },
            { unit: { property: { name: { contains: q, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
  };
  const include = {
    unit: { include: { property: true } },
    consents: { orderBy: { consentedAt: 'desc' as const } },
    reports: { orderBy: { createdAt: 'desc' as const } },
  };
  const filteredCount = await db.application.count({ where });
  const page = pageFrom(params.page, filteredCount);
  const [applications, groups, totalCount, connections] = await Promise.all([
    db.application.findMany({
      where,
      include,
      orderBy: { appliedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.application.groupBy({
      by: ['status'],
      where: { organizationId: session.organizationId, ...scopeWhere },
      _count: { _all: true },
    }),
    db.application.count({ where: { organizationId: session.organizationId, ...scopeWhere } }),
    db.providerConnection.findMany({
      where: { organizationId: session.organizationId, kind: 'SCREENING' },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
  const selected = params.applicant
    ? (applications.find((item) => item.id === params.applicant) ??
      (await db.application.findFirst({ where: { ...where, id: params.applicant }, include })))
    : (applications[0] ?? null);
  const ordered = applications;
  const scopeParams = new URLSearchParams({
    ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
    ...(scope.unitId ? { unitId: scope.unitId } : {}),
  });
  const clearHref = `/applications${scopeParams.size ? `?${scopeParams}` : ''}`;
  const scopedReturn = scope.propertyId
    ? `/properties/${scope.propertyId}/applications${scope.unitId ? `?unit=${encodeURIComponent(scope.unitId)}` : ''}`
    : undefined;
  const countByStatus = new Map(
    groups.map(({ status: itemStatus, _count }) => [itemStatus, _count._all]),
  );
  const selectedConsent =
    selected?.consents.find(
      (item) =>
        connections.some((connection) => connection.provider === item.provider) &&
        hasCurrentConsent(item),
    ) ?? selected?.consents.find((item) => item.provider === 'mock' && hasCurrentConsent(item));
  const connection =
    connections.find((item) => item.provider === selectedConsent?.provider) ??
    connections.find((item) => item.provider === 'transunion') ??
    connections.find((item) => item.status === 'CONNECTED') ??
    connections[0] ??
    null;
  const consentFor = (application: (typeof applications)[number]) => {
    const consent = application.consents.find(
      (item) => item.provider === (connection?.provider ?? 'mock'),
    );
    return hasCurrentConsent(consent);
  };
  const consent = hasCurrentConsent(selectedConsent);
  const report = selected?.reports[0];
  const summary = objectSummary(report?.summary);
  const score = typeof summary.creditScore === 'number' ? summary.creditScore : null;
  const background =
    summary.background === 'clear' || summary.background === 'review' ? summary.background : null;
  const eviction =
    summary.eviction === 'clear' || summary.eviction === 'review' ? summary.eviction : null;
  const reportTone =
    report?.status === 'complete'
      ? 'success'
      : report?.status === 'failed'
        ? 'danger'
        : report?.status === 'pending'
          ? 'warning'
          : 'neutral';
  const canDecide = Boolean(
    selected && consent && selected.status === 'REVIEW' && report?.status === 'complete',
  );
  const providerReady = process.env.NODE_ENV !== 'production' || connection?.status === 'CONNECTED';
  const canScreen = Boolean(
    selected &&
    consent &&
    providerReady &&
    selected.status !== 'APPROVED' &&
    selected.status !== 'DECLINED',
  );
  return (
    <section className={styles.applications} aria-label="Applications and screening">
      <ScopedWorkspace
        organizationId={session.organizationId}
        filter={scope}
        activeTab="applications"
      />
      <PageHeader
        title="Applications"
        eyebrow={scope.propertyId ? 'Leasing / Property applications' : 'Leasing / All properties'}
        actions={[{ label: 'Screening provider', href: '/integrations' }]}
      />
      {scopedReturn && (
        <Link className={styles.backLink} href={scopedReturn}>
          ← Back to property applications
        </Link>
      )}
      <div className={styles.intro}>
        <form
          className={styles.filters}
          action="/applications"
          method="get"
          role="search"
          aria-label="Filter applications"
        >
          <label className={styles.filterField}>
            <span>Search applicants</span>
            <span className={styles.search}>
              <input
                type="search"
                maxLength={100}
                aria-label="Search applicants or units"
                name="q"
                placeholder="Search applicants or units"
                defaultValue={q}
              />
            </span>
          </label>
          <label className={styles.filterField}>
            <span>Application status</span>
            <select aria-label="Filter by status" name="status" defaultValue={status ?? ''}>
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {labels[item]}
                </option>
              ))}
            </select>
          </label>
          {scope.propertyId && <input type="hidden" name="propertyId" value={scope.propertyId} />}
          {scope.unitId && <input type="hidden" name="unitId" value={scope.unitId} />}
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
          {(q || status) && (
            <Link href={clearHref} className="btn btn-ghost btn-sm">
              Clear filters
            </Link>
          )}
        </form>
      </div>
      {params.notice === 'screening' && (
        <p className={styles.notice} role="status">
          Screening request sent. The report status updates when the provider returns a result.
        </p>
      )}
      {params.notice === 'approved' && (
        <p className={styles.notice} role="status">
          Applicant approved. You can create a lease from this review.
        </p>
      )}
      {params.notice === 'declined' && (
        <p className={styles.notice} role="status">
          Decision recorded for this application.
        </p>
      )}

      <section className={styles.summaryStrip} aria-label="Applications at a glance">
        <ApplicationMetric
          label="New applications"
          value={countByStatus.get('SUBMITTED') ?? 0}
          note="Not screened yet"
        />
        <ApplicationMetric
          label="Screening in progress"
          value={countByStatus.get('SCREENING') ?? 0}
          note={
            (countByStatus.get('SCREENING') ?? 0) > 0
              ? 'Waiting on provider'
              : providerReady
                ? 'Provider ready'
                : 'Provider not connected'
          }
        />
        <ApplicationMetric
          label="Ready for decision"
          value={countByStatus.get('REVIEW') ?? 0}
          note={(countByStatus.get('REVIEW') ?? 0) > 0 ? 'Consent recorded' : 'No reports ready'}
        />
      </section>

      <div className={styles.reviewGrid}>
        <ApplicantList count={filteredCount} total={totalCount}>
          {ordered.length ? (
            <ul>
              {ordered.map((application) => {
                const hasConsent = consentFor(application);
                const appReport = objectSummary(application.reports[0]?.summary);
                const needsReview =
                  appReport.background === 'review' || appReport.eviction === 'review';
                const paramsForApplicant = new URLSearchParams();
                if (q) paramsForApplicant.set('q', q);
                if (status) paramsForApplicant.set('status', status);
                if (scope.propertyId) paramsForApplicant.set('propertyId', scope.propertyId);
                if (scope.unitId) paramsForApplicant.set('unitId', scope.unitId);
                paramsForApplicant.set('applicant', application.id);
                if (page > 1) paramsForApplicant.set('page', String(page));
                // A decision stands on its own; consent only matters while screening is still open.
                const decided =
                  application.status === 'APPROVED' || application.status === 'DECLINED';
                return (
                  <li key={application.id}>
                    <Link
                      className={
                        application.id === selected?.id ? styles.applicantActive : styles.applicant
                      }
                      href={
                        '/applications?' + paramsForApplicant.toString() + '#selected-applicant'
                      }
                      aria-current={application.id === selected?.id ? 'true' : undefined}
                    >
                      <Avatar initials={initials(application.applicantName)} />
                      <span className={styles.applicantBody}>
                        <strong>{application.applicantName}</strong>
                        <small>
                          {application.unit.property.name} ·{' '}
                          {application.unit.isImplicit
                            ? 'Whole property'
                            : `Unit ${application.unit.number}`}
                        </small>
                        <span className={styles.metaLine}>
                          <Badge
                            tone={!hasConsent && !decided ? 'neutral' : tones[application.status]}
                          >
                            {decided
                              ? labels[application.status]
                              : !hasConsent
                                ? 'Awaiting consent'
                                : application.status === 'SUBMITTED'
                                  ? 'Ready to screen'
                                  : application.status === 'REVIEW'
                                    ? needsReview
                                      ? 'Needs review'
                                      : 'Ready'
                                    : labels[application.status]}
                          </Badge>
                          <span>
                            {application.reports[0]?.status === 'complete'
                              ? 'Report complete'
                              : formatDate(application.appliedAt)}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="No applications in this view"
              description={
                q || status
                  ? 'Clear search and status filters to see applications in this scope.'
                  : 'New applications for this scope will appear here.'
              }
              action={q || status ? 'Clear filters' : 'View properties'}
              href={q || status ? clearHref : '/properties'}
            />
          )}
          <Pagination
            page={page}
            total={filteredCount}
            noun="applications"
            href={(p) => {
              const next = new URLSearchParams();
              if (q) next.set('q', q);
              if (status) next.set('status', status);
              if (scope.propertyId) next.set('propertyId', scope.propertyId);
              if (scope.unitId) next.set('unitId', scope.unitId);
              next.set('page', String(p));
              return '/applications?' + next.toString();
            }}
          />
        </ApplicantList>

        {selected ? (
          <section
            className={styles.detail}
            id="selected-applicant"
            tabIndex={-1}
            aria-labelledby="selected-title"
          >
            <BackToApplicants />
            <div className={styles.detailHeader}>
              <div className={styles.identity}>
                <Avatar initials={initials(selected.applicantName)} size="lg" />
                <div>
                  <p className={styles.eyebrow}>Selected applicant</p>
                  <h2 id="selected-title">{selected.applicantName}</h2>
                  <p className={styles.unitLine}>
                    <Link href={'/properties/' + selected.unit.propertyId}>
                      {selected.unit.property.name}
                    </Link>
                    {' · '}
                    <Link
                      href={
                        '/properties/' +
                        selected.unit.propertyId +
                        '?unit=' +
                        encodeURIComponent(selected.unit.id)
                      }
                    >
                      {selected.unit.isImplicit ? 'Whole property' : `Unit ${selected.unit.number}`}
                    </Link>
                    {' · Applied '}
                    {formatDate(selected.appliedAt)}
                  </p>
                </div>
              </div>
              <Badge tone={tones[selected.status]}>
                {selected.status === 'SUBMITTED' && consent
                  ? 'Ready to screen'
                  : labels[selected.status]}
              </Badge>
            </div>
            <p className={styles.applicantContact}>
              <a href={`mailto:${selected.applicantEmail}`}>{selected.applicantEmail}</a>
            </p>
            <div className={styles.provider}>
              <span className={styles.providerLogo} aria-hidden="true">
                {connection?.provider === 'transunion' ? 'TU' : 'S'}
              </span>
              <div className={styles.providerText}>
                <strong>
                  {connection?.provider === 'transunion'
                    ? 'TransUnion SmartMove'
                    : (connection?.provider ?? 'Screening provider')}
                </strong>
                <small>
                  {report
                    ? report.provider.toUpperCase() +
                      ' screening report · ' +
                      formatDate(report.completedAt ?? report.createdAt)
                    : 'No screening report yet'}
                </small>
              </div>
              <Badge tone={providerReady ? 'info' : 'warning'}>
                {process.env.NODE_ENV === 'production'
                  ? (connection?.status ?? 'Not connected')
                  : 'Connected · development mock'}
              </Badge>
            </div>
            <div className={styles.reportHeading}>
              <h3>Applicant review</h3>
              <Badge tone={reportTone}>
                {report ? 'Report ' + report.status : 'Report not run'}
              </Badge>
            </div>
            <div className={styles.reportGrid}>
              <article className={styles.reportCard}>
                <span>Credit score</span>
                <strong>{score ?? '—'}</strong>
                <small>{score === null ? 'Not available' : score >= 700 ? 'Good' : 'Review'}</small>
              </article>
              <article className={styles.reportCard}>
                <span>Background check</span>
                <strong>{background ? (background === 'clear' ? 'Clear' : 'Review') : '—'}</strong>
                <small>
                  {background
                    ? background === 'clear'
                      ? 'No records found'
                      : 'Follow up required'
                    : 'Not available'}
                </small>
              </article>
              <article className={styles.reportCard}>
                <span>Eviction check</span>
                <strong>{eviction ? (eviction === 'clear' ? 'Clear' : 'Review') : '—'}</strong>
                <small>
                  {eviction
                    ? eviction === 'clear'
                      ? 'No filings found'
                      : 'Follow up required'
                    : 'Not available'}
                </small>
              </article>
            </div>
            <div className={styles.noticeGrid}>
              <div className={consent ? styles.consent : styles.consentPending}>
                <span aria-hidden="true">{consent ? '✓' : '!'}</span>
                <div>
                  <strong>{consent ? 'FCRA consent recorded' : 'FCRA consent required'}</strong>
                  <p>
                    {consent
                      ? 'Applicant authorization received ' +
                        formatDate(selectedConsent?.consentedAt) +
                        ' · ' +
                        selectedConsent?.consentVersion
                      : 'Screening is blocked until the applicant provides current, unrevoked authorization.'}
                  </p>
                </div>
              </div>
              <div className={styles.fairHousing}>
                <span aria-hidden="true">i</span>
                <div>
                  <strong>Fair housing review</strong>
                  <p>
                    Apply the same written screening criteria to every applicant. Do not consider
                    protected characteristics.
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.screeningAction}>
              <div>
                <strong>
                  {report?.status === 'failed'
                    ? 'Screening report failed'
                    : report?.status === 'complete'
                      ? 'Screening report received'
                      : 'Run applicant screening'}
                </strong>
                <p>
                  {selected.status === 'APPROVED' || selected.status === 'DECLINED'
                    ? 'This application has a recorded decision.'
                    : !providerReady
                      ? 'Connect the screening provider in Integrations before requesting a report.'
                      : !consent
                        ? 'A current FCRA consent is required before the provider can be contacted.'
                        : process.env.NODE_ENV !== 'production'
                          ? 'Use the development mock to request or refresh this report.'
                          : 'Use the connected screening provider to request or refresh this report.'}
                </p>
              </div>
              <form action={requestScreening}>
                <input type="hidden" name="applicationId" value={selected.id} />
                {scope.propertyId && (
                  <input type="hidden" name="propertyId" value={scope.propertyId} />
                )}
                {scope.unitId && <input type="hidden" name="unitId" value={scope.unitId} />}
                <ScreeningSubmit disabled={!canScreen} again={Boolean(report)} />
              </form>
            </div>
            <div className={styles.decisionSection}>
              <h3>Decision</h3>
              <p>
                Review the complete provider report and apply the same written criteria before
                deciding.
              </p>
              {canDecide ? (
                <ReviewDecisionForm
                  key={selected.id}
                  action={recordDecision}
                  applicationId={selected.id}
                  propertyId={scope.propertyId}
                  unitId={scope.unitId}
                />
              ) : selected.status === 'APPROVED' ? (
                <div className={styles.decisionButtons}>
                  <Button
                    href={
                      '/leases/new?unit=' +
                      encodeURIComponent(selected.unitId) +
                      '&applicant=' +
                      encodeURIComponent(selected.id)
                    }
                    variant="primary"
                  >
                    Create lease <ApplicationArrow />
                  </Button>
                </div>
              ) : (
                <>
                  <p className={styles.decisionHelp}>
                    {selected.status === 'DECLINED'
                      ? 'This application was declined. The recorded decision is retained in its history.'
                      : 'A completed report and current consent are required before a decision.'}
                  </p>
                  <div className={styles.decisionButtons}>
                    <Button variant="secondary" disabled>
                      Decline
                    </Button>
                    <Button variant="secondary" disabled>
                      Approve
                    </Button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className={styles.detail}>
            <h2>
              {params.applicant
                ? 'Applicant unavailable in this view'
                : 'Select an applicant to review'}
            </h2>
            <p>
              {params.applicant
                ? 'Choose an applicant from the list or clear filters to return to this scope.'
                : 'Choose an application to see consent and screening report details.'}
            </p>
            {(q || status || params.applicant) && (
              <Link href={clearHref} className="btn btn-secondary btn-sm">
                Reset review
              </Link>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
