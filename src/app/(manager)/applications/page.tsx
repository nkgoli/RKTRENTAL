import Link from 'next/link';
import { EmptyState } from '@/components/RouteStates';
import { redirect } from 'next/navigation';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/shell/PageHeader';
import { db } from '@/lib/db/client';
import { getSession } from '@/lib/auth/server-session';
import { hasCurrentConsent, type ApplicationStatus } from '@/lib/screening/policy';
import { recordDecision, requestScreening } from './actions';
import styles from './applications.module.css';

type SearchParams = { applicant?: string; notice?: string; q?: string; status?: string };
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
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}
function formatDate(value: Date | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(value);
}
function objectSummary(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  if (!session || !['MANAGER', 'OWNER', 'ADMIN'].includes(session.role)) redirect('/sign-in');
  const q = params.q?.trim().slice(0, 100) ?? '';
  const status = statuses.includes(params.status as ApplicationStatus) ? params.status as ApplicationStatus : undefined;
  const where = {
    organizationId: session.organizationId,
    ...(status ? { status } : {}),
    ...(q ? { OR: [
      { applicantName: { contains: q, mode: 'insensitive' as const } },
      { applicantEmail: { contains: q, mode: 'insensitive' as const } },
      { unit: { number: { contains: q, mode: 'insensitive' as const } } },
      { unit: { property: { name: { contains: q, mode: 'insensitive' as const } } } },
    ] } : {}),
  };
  const [applications, groups, totalCount, connections] = await Promise.all([
    db.application.findMany({
      where,
      include: {
        unit: { include: { property: true } },
        consents: { orderBy: { consentedAt: 'desc' } },
        reports: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { appliedAt: 'desc' },
    }),
    db.application.groupBy({ by: ['status'], where: { organizationId: session.organizationId }, _count: { _all: true } }),
    db.application.count({ where: { organizationId: session.organizationId } }),
    db.providerConnection.findMany({
      where: { organizationId: session.organizationId, kind: 'SCREENING' },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
  const selectedId = params.applicant ?? 'seed-application-olivia';
  const selected = applications.find((item) => item.id === selectedId) ?? applications[0] ?? null;
  const ordered = selected ? [selected, ...applications.filter((item) => item.id !== selected.id)] : applications;
  const countByStatus = new Map(groups.map(({ status: itemStatus, _count }) => [itemStatus, _count._all]));
  const selectedConsent = selected?.consents.find((item) =>
    connections.some((connection) => connection.provider === item.provider) && hasCurrentConsent(item),
  ) ?? selected?.consents.find((item) => item.provider === 'mock' && hasCurrentConsent(item));
  const connection =
    connections.find((item) => item.provider === selectedConsent?.provider) ??
    connections.find((item) => item.provider === 'transunion') ??
    connections.find((item) => item.status === 'CONNECTED') ??
    connections[0] ??
    null;
  const consentFor = (application: (typeof applications)[number]) => {
    const consent = application.consents.find((item) => item.provider === (connection?.provider ?? 'mock'));
    return hasCurrentConsent(consent);
  };
  const consent = hasCurrentConsent(selectedConsent);
  const report = selected?.reports[0];
  const summary = objectSummary(report?.summary);
  const score = typeof summary.creditScore === 'number' ? summary.creditScore : null;
  const background = summary.background === 'clear' || summary.background === 'review' ? summary.background : null;
  const eviction = summary.eviction === 'clear' || summary.eviction === 'review' ? summary.eviction : null;
  const reportTone = report?.status === 'complete' ? 'success' : report?.status === 'failed' ? 'danger' : report?.status === 'pending' ? 'warning' : 'neutral';
  const canDecide = Boolean(selected && consent && selected.status === 'REVIEW' && report?.status === 'complete');
  const providerReady = process.env.NODE_ENV !== 'production' || connection?.status === 'CONNECTED';
  const canScreen = Boolean(selected && consent && providerReady && selected.status !== 'APPROVED' && selected.status !== 'DECLINED');
  const providerName = connection?.provider === 'transunion' ? 'TransUnion SmartMove' : connection?.provider;
  const providerAction = connection
    ? providerName + (providerReady ? ' connected' : ' disconnected')
    : 'Screening provider unavailable';

  return (
    <section className={styles.applications} aria-label="Applications and screening">
      <PageHeader
        title="Applications"
        eyebrow="Leasing"
        actions={[
          { label: providerAction, href: '/integrations' },
          { label: 'Manage provider', href: '/integrations' },
        ]}
      />
      <div className={styles.intro}>
        <div>
          <h2>Applicant review</h2>
          <p>Review screening reports and application status across your portfolio.</p>
        </div>
        <form className={styles.filters} action="/applications" method="get">
          <label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="Search applicants or units" name="q" placeholder="Search applicants or units" defaultValue={q} /></label>
          <select aria-label="Filter by status" name="status" defaultValue={status ?? ''}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
          </select>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>
      {params.notice === 'screening' && <p className={styles.notice} role="status">Screening request sent. The report status updates when the provider returns a result.</p>}
      {params.notice === 'approved' && <p className={styles.notice} role="status">Applicant approved. You can create a lease from this review.</p>}
      {params.notice === 'declined' && <p className={styles.notice} role="status">Decision recorded for this application.</p>}

      <div className={styles.stats}>
        <article className={styles.stat}><span>New applications</span><strong>{countByStatus.get('SUBMITTED') ?? 0}</strong><small>{(countByStatus.get('SUBMITTED') ?? 0) + (countByStatus.get('SCREENING') ?? 0)} need review</small></article>
        <article className={styles.stat}><span>Screening in progress</span><strong>{countByStatus.get('SCREENING') ?? 0}</strong><small>{(countByStatus.get('SCREENING') ?? 0) > 0 ? 'Waiting on provider' : providerReady ? 'Provider ready' : 'Provider not connected'}</small></article>
        <article className={styles.stat}><span>Ready for decision</span><strong>{countByStatus.get('REVIEW') ?? 0}</strong><small>{(countByStatus.get('REVIEW') ?? 0) > 0 ? 'Consent recorded' : 'No reports ready'}</small></article>
      </div>

      <div className={styles.reviewGrid}>
        <section className={styles.listCard} aria-labelledby="applicants-title">
          <div className={styles.listHeader}>
            <div><h3 id="applicants-title">Applicants</h3><p>Showing {ordered.length} of {totalCount} applications</p></div>
            <Badge>{totalCount} total</Badge>
          </div>
          {ordered.length ? <ul>{ordered.map((application) => {
            const hasConsent = consentFor(application);
            const appReport = objectSummary(application.reports[0]?.summary);
            const needsReview = appReport.background === 'review' || appReport.eviction === 'review';
            const paramsForApplicant = new URLSearchParams();
            if (q) paramsForApplicant.set('q', q);
            if (status) paramsForApplicant.set('status', status);
            paramsForApplicant.set('applicant', application.id);
            return <li key={application.id}>
              <Link
                className={application.id === selected?.id ? styles.applicantActive : styles.applicant}
                href={'/applications?' + paramsForApplicant.toString()}
                aria-current={application.id === selected?.id ? 'true' : undefined}
              >
                <Avatar initials={initials(application.applicantName)} />
                <span className={styles.applicantBody}>
                  <strong>{application.applicantName}</strong>
                  <small>{application.unit.property.name} · Unit {application.unit.number}</small>
                  <span className={styles.metaLine}>
                    <Badge tone={!hasConsent ? 'neutral' : tones[application.status]}>
                      {!hasConsent ? 'Awaiting consent' : application.status === 'SUBMITTED' ? 'Ready to screen' : application.status === 'REVIEW' ? needsReview ? 'Needs review' : 'Ready' : labels[application.status]}
                    </Badge>
                    <span>{application.reports[0]?.status === 'complete' ? 'Report complete' : formatDate(application.appliedAt)}</span>
                  </span>
                </span>
              </Link>
            </li>;
          })}</ul> : <EmptyState title="No applications in this view" description="Check the other filters or choose a property to review applicants." action="View properties" href="/properties" />}
        </section>

        {selected ? <section className={styles.detail} id="selected-applicant" aria-labelledby="selected-title">
          <div className={styles.detailHeader}>
            <div className={styles.identity}>
              <Avatar initials={initials(selected.applicantName)} size="lg" />
              <div>
                <p className={styles.eyebrow}>Selected applicant</p>
                <h2 id="selected-title">{selected.applicantName}</h2>
                <p className={styles.unitLine}>
                  <Link href={'/properties/' + selected.unit.propertyId}>{selected.unit.property.name}</Link>
                  {' · '}
                  <Link href={'/properties/' + selected.unit.propertyId + '#unit-' + selected.unit.id}>Unit {selected.unit.number}</Link>
                  {' · Applied '}{formatDate(selected.appliedAt)}
                </p>
              </div>
            </div>
            <Badge tone={report?.status === 'complete' ? 'success' : tones[selected.status]}>{report?.status === 'complete' ? 'Report complete' : labels[selected.status]}</Badge>
          </div>
          <div className={styles.provider}>
            <span className={styles.providerLogo}>TU</span>
            <div className={styles.providerText}>
              <strong>{connection?.provider === 'transunion' ? 'TransUnion SmartMove' : connection?.provider ?? 'Screening provider'}</strong>
              <small>{report ? report.provider.toUpperCase() + ' screening report · ' + formatDate(report.completedAt ?? report.createdAt) : 'No screening report yet'}</small>
            </div>
            <Badge tone={providerReady ? 'info' : 'warning'}>{process.env.NODE_ENV === 'production' ? connection?.status ?? 'Not connected' : 'Connected · development mock'}</Badge>
          </div>
          <div className={styles.reportHeading}>
            <h3>Applicant review</h3>
            <Badge tone={reportTone}>{report ? 'Report ' + report.status : 'Report not run'}</Badge>
          </div>
          <div className={styles.reportGrid}>
            <article className={styles.reportCard}><span>Credit score</span><strong>{score ?? '—'}</strong><small>{score === null ? 'Not available' : score >= 700 ? 'Good' : 'Review'}</small></article>
            <article className={styles.reportCard}><span>Background check</span><strong>{background ? background === 'clear' ? 'Clear' : 'Review' : '—'}</strong><small>{background ? background === 'clear' ? 'No records found' : 'Follow up required' : 'Not available'}</small></article>
            <article className={styles.reportCard}><span>Eviction check</span><strong>{eviction ? eviction === 'clear' ? 'Clear' : 'Review' : '—'}</strong><small>{eviction ? eviction === 'clear' ? 'No filings found' : 'Follow up required' : 'Not available'}</small></article>
          </div>
          <div className={styles.noticeGrid}>
            <div className={consent ? styles.consent : styles.consentPending}>
              <span aria-hidden="true">{consent ? '✓' : '!'}</span>
              <div><strong>{consent ? 'FCRA consent recorded' : 'FCRA consent required'}</strong>
                <p>{consent ? 'Applicant authorization received ' + formatDate(selectedConsent?.consentedAt) + ' · ' + selectedConsent?.consentVersion : 'Screening is blocked until the applicant provides current, unrevoked authorization.'}</p>
              </div>
            </div>
            <div className={styles.fairHousing}><span aria-hidden="true">i</span><div><strong>Fair housing review</strong><p>Apply the same written screening criteria to every applicant. Do not consider protected characteristics.</p></div></div>
          </div>
          <div className={styles.screeningAction}>
            <div><strong>{report?.status === 'complete' ? 'Screening report received' : 'Run applicant screening'}</strong><p>{!consent ? 'A current FCRA consent is required before the provider can be contacted.' : process.env.NODE_ENV !== 'production' ? 'Use the development mock to request or refresh this report.' : 'Use the connected screening provider to request or refresh this report.'}</p></div>
            <form action={requestScreening}>
              <input type="hidden" name="applicationId" value={selected.id} />
              <Button type="submit" variant="secondary" disabled={!canScreen}>{report ? 'Run screening again' : 'Run screening'}</Button>
            </form>
          </div>
          <div className={styles.decisionSection}>
            <p>Review the complete provider report and apply the same written criteria before deciding.</p>
            {canDecide ? <form action={recordDecision} className={styles.decisionForm}>
              <input type="hidden" name="applicationId" value={selected.id} />
              <label><span>Decision reason</span><select name="reason" defaultValue="" required>
                <option value="" disabled>Select a written screening reason</option>
                <option value="criteria-met">Meets written screening criteria</option>
                <option value="credit-below-criteria">Credit score below written criteria</option>
                <option value="background-review">Background report requires review</option>
                <option value="eviction-review">Eviction report requires review</option>
                <option value="application-incomplete">Application information incomplete</option>
              </select></label>
              <div className={styles.decisionButtons}>
                <Button type="submit" name="decision" value="DECLINED" variant="danger">Decline</Button>
                <Button type="submit" name="decision" value="APPROVED" variant="secondary">Approve</Button>
              </div>
            </form> : selected.status === 'APPROVED' ? <div className={styles.decisionButtons}>
              <Button href={'/leases/new?unit=' + encodeURIComponent(selected.unitId) + '&applicant=' + encodeURIComponent(selected.id)} variant="primary">Create lease →</Button>
            </div> : <div className={styles.decisionButtons}>
              <Button variant="secondary" disabled>Decline</Button><Button variant="secondary" disabled>Approve</Button>
            </div>}
          </div>
        </section> : <section className={styles.detail}><h2>Select an applicant to review</h2><p>Choose an application to see consent and screening report details.</p></section>}
      </div>
    </section>
  );
}
