import Link from 'next/link';
import { EmptyState } from '@/components/RouteStates';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchField, AutoSubmitSelect, NoticeToast, Alert, Steps, Tabs } from '@/components/ui';
import { SummaryBand } from '@/components/ui/SummaryBand';
import { applicationStatusLabels as labels, applicationStatusTone } from './status';
import { Pagination, PAGE_SIZE, pageFrom } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom, unitScopeWhere } from '@/lib/workspace/scope';
import { db } from '@/lib/db/client';
import { requireManagerRole } from '@/lib/auth/access';
import { hasCurrentConsent, type ApplicationStatus } from '@/lib/screening/policy';
import { isSandboxEnabled } from '@/lib/providers/sandbox';
import {
  applicationStage,
  currentScreeningConsent,
  pipelineCounts,
  pipelineDetail,
  reviewSteps,
  screeningProviderStatus,
} from '@/lib/applications/pipeline';
import { invitationLinkConfigurationError } from '@/lib/applications/link-config';
import { recordDecision, requestScreening } from './actions';
import { ReviewDecisionForm, ScreeningSubmit } from './ReviewForms';
import { ApplicantList, BackToApplicants } from './ApplicantList';
import styles from './applications.module.css';
import { PromoteApplicant } from '@/components/applications/PromoteApplicant';
import { InvitationGuide, InvitationList } from '@/components/applications/InvitationList';

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
const openStatuses: ApplicationStatus[] = ['SUBMITTED', 'SCREENING', 'REVIEW'];
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
function shortDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}
function objectSummary(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  const [applications, groups, totalCount, connections, pipelineRows] = await Promise.all([
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
    // Every undecided submitted application in scope, independent of search, filter and page.
    db.application.findMany({
      where: {
        organizationId: session.organizationId,
        ...scopeWhere,
        status: { in: openStatuses },
      },
      select: {
        id: true,
        status: true,
        consents: {
          select: { provider: true, consentedAt: true, consentVersion: true, revokedAt: true },
        },
        reports: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
      },
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
  const providers = connections.map((item) => item.provider);
  const providerStatus = screeningProviderStatus(connections, isSandboxEnabled());
  const linksUnavailable = invitationLinkConfigurationError();
  const stageOf = (application: {
    status: ApplicationStatus;
    consents: Parameters<typeof currentScreeningConsent>[0];
    reports: { status: string }[];
  }) =>
    applicationStage({
      status: application.status,
      consent: Boolean(currentScreeningConsent(application.consents, providers)),
      reportStatus: application.reports[0]?.status,
    });
  const counts = pipelineCounts(
    pipelineRows.filter((row) => openStatuses.includes(row.status)).map(stageOf),
  );
  const notScreened = counts.awaitingConsent + counts.readyToScreen;

  const selectedConsent = selected
    ? currentScreeningConsent(selected.consents, providers)
    : undefined;
  const connection =
    connections.find((item) => item.provider === selectedConsent?.provider) ??
    connections.find((item) => item.provider === 'transunion') ??
    connections.find((item) => item.status === 'CONNECTED') ??
    connections[0] ??
    null;
  const consent = hasCurrentConsent(selectedConsent);
  const report = selected?.reports[0];
  const summary = objectSummary(report?.summary);
  const score = typeof summary.creditScore === 'number' ? summary.creditScore : null;
  const background =
    summary.background === 'clear' || summary.background === 'review' ? summary.background : null;
  const eviction =
    summary.eviction === 'clear' || summary.eviction === 'review' ? summary.eviction : null;
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
  const selectedStage = selected ? stageOf(selected) : null;
  const selectedSteps = selectedStage
    ? reviewSteps(selectedStage, Boolean(selected?.promotedTenantId))
    : null;
  const listHref = (next: { status?: ApplicationStatus }) => {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (next.status) query.set('status', next.status);
    if (scope.propertyId) query.set('propertyId', scope.propertyId);
    if (scope.unitId) query.set('unitId', scope.unitId);
    return `/applications${query.size ? `?${query}` : ''}`;
  };
  const statusTabs = [
    { label: 'All', href: listHref({}), active: !status, count: totalCount },
    {
      label: 'Ready',
      href: listHref({ status: 'REVIEW' }),
      active: status === 'REVIEW',
      count: countByStatus.get('REVIEW') ?? 0,
    },
    {
      label: 'Screening',
      href: listHref({ status: 'SCREENING' }),
      active: status === 'SCREENING',
      count: countByStatus.get('SCREENING') ?? 0,
    },
    {
      label: 'Consent',
      href: listHref({ status: 'SUBMITTED' }),
      active: status === 'SUBMITTED',
      count: countByStatus.get('SUBMITTED') ?? 0,
    },
  ];
  return (
    <section className={styles.applications} aria-label="Applications and screening">
      <ScopedWorkspace
        organizationId={session.organizationId}
        filter={scope}
        activeTab="applications"
      />
      <PageHeader
        title="Applications & invitations"
        eyebrow={scope.propertyId ? 'Leasing · Property applications' : 'Leasing'}
        meta={`${scope.propertyId ? 'Applications for this property' : 'All properties'} · ${providerStatus.label}`}
        actions={[
          { label: 'Screening provider', href: '/integrations#screening-providers' },
          {
            label: 'Send application',
            href: `/applications/send${scopeParams.size ? `?${scopeParams}` : ''}`,
            primary: true,
            icon: 'arrow-right',
          },
        ]}
      />
      {scopedReturn && (
        <Link className={styles.backLink} href={scopedReturn}>
          ← Back to property applications
        </Link>
      )}
      {params.notice === 'screening' && (
        <NoticeToast message="Screening request sent. The report status updates when the provider returns a result." />
      )}
      {params.notice === 'approved' && (
        <NoticeToast message="Applicant approved. Promote them to a tenant to continue with lease setup." />
      )}
      {params.notice === 'declined' && (
        <NoticeToast message="Decision recorded for this application." />
      )}

      <SummaryBand
        eyebrow="Leasing pipeline · submitted applications"
        label="Applications at a glance"
        value={`${counts.toReview} to review`}
        detail={pipelineDetail(counts)}
        progress={{
          label: `${counts.ready} of ${counts.toReview} have a complete report and recorded consent`,
          value: counts.toReview ? (counts.ready / counts.toReview) * 100 : 0,
          valueText: `${counts.ready} of ${counts.toReview}`,
          tone: 'accent',
        }}
        footer={
          <p className={styles.bandNote}>
            Invitations and saved drafts are tracked separately and never count here.
          </p>
        }
        stats={[
          {
            label: 'New applications',
            value: notScreened,
            detail: `Not screened yet · ${counts.awaitingConsent} awaiting consent`,
          },
          {
            label: 'Screening in progress',
            value: counts.screening,
            detail: counts.screening > 0 ? 'Waiting on provider' : providerStatus.label,
          },
          {
            label: 'Ready for decision',
            value: counts.ready,
            detail: 'Consent recorded · report complete',
          },
        ]}
      />

      <div className={styles.invitationGrid}>
        {await InvitationList({
          organizationId: session.organizationId,
          scope,
          linksUnavailable,
        })}
        <InvitationGuide />
      </div>

      <div className={styles.reviewGrid}>
        <ApplicantList count={filteredCount} total={totalCount}>
          <form
            className={styles.filters}
            action="/applications"
            method="get"
            role="search"
            aria-label="Filter applications"
          >
            <div className={`${styles.filterField} ${styles.search}`}>
              <SearchField
                maxLength={100}
                aria-label="Search applicants or units"
                name="q"
                placeholder="Search applicants or units"
                defaultValue={q}
              />
            </div>
            <label className={`field ${styles.filterField}`}>
              <span className="field-label">Application status</span>
              <AutoSubmitSelect
                aria-label="Filter by status"
                name="status"
                defaultValue={status ?? ''}
              >
                <option value="">All statuses</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item === 'REVIEW' ? 'Ready for decision' : labels[item]}
                  </option>
                ))}
              </AutoSubmitSelect>
            </label>
            {scope.propertyId && <input type="hidden" name="propertyId" value={scope.propertyId} />}
            {scope.unitId && <input type="hidden" name="unitId" value={scope.unitId} />}
            {(q || status) && (
              <Link href={clearHref} className="btn btn-ghost btn-sm">
                Clear filters
              </Link>
            )}
          </form>
          <div className={styles.phoneTabs}>
            <Tabs items={statusTabs} label="Application status" />
          </div>
          {ordered.length ? (
            <ul className={styles.applicantRows}>
              {ordered.map((application) => {
                const stage = stageOf(application);
                const hasConsent = stage !== 'awaiting-consent';
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
                const active = application.id === selected?.id;
                return (
                  <li key={application.id}>
                    <Link
                      className={active ? styles.applicantActive : styles.applicant}
                      href={
                        '/applications?' + paramsForApplicant.toString() + '#selected-applicant'
                      }
                      aria-current={active ? 'true' : undefined}
                    >
                      <span className={styles.applicantTop}>
                        <strong>{application.applicantName}</strong>
                        <Badge
                          tone={
                            !hasConsent && !decided
                              ? 'neutral'
                              : applicationStatusTone(application.status)
                          }
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
                      </span>
                      <small>
                        {application.unit.property.name} ·{' '}
                        {application.unit.isImplicit
                          ? 'Whole property'
                          : `Unit ${application.unit.number}`}{' '}
                        · {shortDate(application.appliedAt)}
                        {active ? ' · selected' : ''}
                      </small>
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
            className={`card ${styles.detail}`}
            id="selected-applicant"
            tabIndex={-1}
            aria-labelledby="selected-title"
          >
            <BackToApplicants />
            <div className={styles.detailHeader}>
              <div className={styles.identity}>
                <Avatar initials={initials(selected.applicantName)} size="lg" />
                <div>
                  <p className="eyebrow">Selected applicant</p>
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
                    {' / '}
                    <a href={`mailto:${selected.applicantEmail}`}>{selected.applicantEmail}</a>
                  </p>
                </div>
              </div>
              <Badge tone={applicationStatusTone(selected.status)}>
                {selected.status === 'SUBMITTED' && consent
                  ? 'Ready to screen'
                  : labels[selected.status]}
              </Badge>
            </div>
            {selectedSteps && (
              <div className={styles.stepsWrap}>
                <Steps steps={selectedSteps.steps} current={selectedSteps.current} />
              </div>
            )}
            <div className={styles.provider}>
              <div className={styles.providerText}>
                <strong>{providerStatus.label}</strong>
                <small>
                  {report
                    ? `Report ${report.status} · ${report.provider.toUpperCase()} screening report · ${formatDate(report.completedAt ?? report.createdAt)}`
                    : 'No screening report yet'}
                </small>
                <small id="screening-help">
                  {selected.status === 'APPROVED' || selected.status === 'DECLINED'
                    ? 'This application has a recorded decision.'
                    : !providerReady
                      ? 'Connect the screening provider in Integrations before requesting a report.'
                      : !consent
                        ? 'A current FCRA consent is required before the provider can be contacted.'
                        : providerStatus.state === 'sandbox'
                          ? 'Requests run in sandbox mode; no consumer report is ordered.'
                          : 'Use the screening provider to request or refresh this report.'}
                </small>
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
            <div className={styles.reportGrid} aria-label="Screening report">
              <div className="summary-stat">
                <span className="summary-stat-label">Credit score</span>
                <strong>{score ?? '—'}</strong>
                <small>{score === null ? 'Not available' : score >= 700 ? 'Good' : 'Review'}</small>
              </div>
              <div className="summary-stat">
                <span className="summary-stat-label">Background check</span>
                <strong>{background ? (background === 'clear' ? 'Clear' : 'Review') : '—'}</strong>
                <small>
                  {background
                    ? background === 'clear'
                      ? 'No records found'
                      : 'Follow up required'
                    : 'Not available'}
                </small>
              </div>
              <div className="summary-stat">
                <span className="summary-stat-label">Eviction check</span>
                <strong>{eviction ? (eviction === 'clear' ? 'Clear' : 'Review') : '—'}</strong>
                <small>
                  {eviction
                    ? eviction === 'clear'
                      ? 'No filings found'
                      : 'Follow up required'
                    : 'Not available'}
                </small>
              </div>
            </div>
            <div className={styles.noticeGrid}>
              <Alert tone={consent ? 'success' : 'warning'}>
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
              </Alert>
              <Alert>
                <div>
                  <strong>Fair housing review</strong>
                  <p>
                    Apply the same written screening criteria to every applicant. Do not consider
                    protected characteristics.
                  </p>
                </div>
              </Alert>
            </div>
            <hr className={styles.divider} />
            <div className={styles.decisionSection}>
              <h3>Decision</h3>
              <p>
                {selected.status === 'APPROVED'
                  ? 'Approved. Promote to tenant links this approved applicant to a tenant record.'
                  : 'Review the complete provider report and apply the same written criteria before deciding.'}
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
                <PromoteApplicant
                  key={selected.id}
                  applicationId={selected.id}
                  unitId={selected.unitId}
                  tenantId={selected.promotedTenantId}
                />
              ) : (
                <>
                  <p className={styles.decisionHelp} id="decision-help">
                    {selected.status === 'DECLINED'
                      ? 'This application was declined. The recorded decision is retained in its history.'
                      : 'A completed report and current consent are required before a decision.'}
                  </p>
                  <div className={styles.decisionButtons}>
                    <Button variant="secondary" disabled aria-describedby="decision-help">
                      Decline
                    </Button>
                    <Button variant="primary" disabled aria-describedby="decision-help">
                      Approve
                    </Button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className={`card ${styles.detail}`}>
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
