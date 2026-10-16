import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { db } from '@/lib/db/client';
import { loadIntegrations } from '@/lib/integrations/service';
import { SCREENING_PACKAGES } from '@/lib/integrations/settings';
import type { ApplicationStatus } from '@/lib/screening/policy';
import { unitScopeWhere, scopeQuery, type ScopeFilter } from '@/lib/workspace/scope';
import { saveApplicationSettingsAction } from './actions';
import { withUnit } from './scope';
import styles from './leasing.module.css';

const labels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Awaiting consent',
  SCREENING: 'Screening in progress',
  REVIEW: 'Ready for review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
};
const tones: Record<ApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  SUBMITTED: 'neutral', SCREENING: 'warning', REVIEW: 'success', APPROVED: 'success', DECLINED: 'danger',
};
const collected = ['Contact details', 'Employment and income', 'Rental history', 'Photo ID', 'Consent to screening'];
const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  'settings-saved': { tone: 'success', text: 'Application settings saved.' },
  'settings-invalid': { tone: 'warning', text: 'Those screening settings are not supported.' },
};
const date = (value: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(value);

/** Applications for one property (and optionally one unit), grouped by household; applicants open the existing review page. */
export async function ApplicationsPanel({ organizationId, scope, hideArchived = false, notice }: {
  organizationId: string;
  scope: ScopeFilter;
  /** Archived households (archivedAt set) are closed out and no longer in play. */
  hideArchived?: boolean;
  notice?: string;
}) {
  const [applications, integrations] = await Promise.all([
    db.application.findMany({
      where: { organizationId, ...unitScopeWhere(scope) },
      include: { unit: true, applicationGroup: true },
      orderBy: { appliedAt: 'desc' },
    }),
    loadIntegrations(organizationId, db.providerConnection),
  ]);
  const screening = integrations.settings.screening;
  const archivedCount = new Set(applications.filter((a) => a.applicationGroup?.archivedAt).map((a) => a.applicationGroupId)).size;
  const visible = hideArchived ? applications.filter((a) => !a.applicationGroup?.archivedAt) : applications;

  // An application without a household is its own group.
  type Group = { key: string; unitId: string; label: string; status: ApplicationStatus; items: typeof applications };
  const groups = new Map<string, Group>();
  for (const application of visible) {
    const key = application.applicationGroupId ?? `solo:${application.id}`;
    const group = groups.get(key) ?? {
      key,
      unitId: application.unitId,
      label: application.unit.isImplicit ? 'Whole property' : `Unit ${application.unit.number}`,
      status: (application.applicationGroup?.status ?? application.status) as ApplicationStatus,
      items: [],
    };
    group.items.push(application);
    groups.set(key, group);
  }

  const reviewHref = (id: string) => {
    const query = scopeQuery(scope);
    query.set('applicant', id);
    return `/applications?${query}`;
  };
  const leaseHref = (unitId: string, applicantId: string) => `/leases/new?${new URLSearchParams({ unit: unitId, applicant: applicantId })}`;
  const toggleHref = withUnit(`/properties/${scope.propertyId}/applications`, scope.unitId, hideArchived ? {} : { hideArchived: '1' });
  const message = notice ? notices[notice] : undefined;

  return <section className={styles.panel} aria-label="Applications">
    {message && <Alert tone={message.tone}><div>{message.text}</div></Alert>}
    <form action={saveApplicationSettingsAction} className="card" aria-label="Application settings">
      <input type="hidden" name="propertyId" value={scope.propertyId} />
      <input type="hidden" name="unitId" value={scope.unitId ?? ''} />
      <input type="hidden" name="applicantConsent" value={screening.applicantConsent} />
      <div className="card-header">
        <h3>Application settings</h3>
        <Button type="submit" variant="secondary" size="sm">Save</Button>
      </div>
      <div className={styles.settings}>
        <div>
          <p className={styles.settingLabel}>What we collect</p>
          <ul className={styles.chips}>{collected.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <label className={styles.settingField}>
          <span className={styles.settingLabel}>Screening reports</span>
          <select name="defaultPackage" defaultValue={screening.defaultPackage}>
            {SCREENING_PACKAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <small className="muted">Applicants consent before each report is ordered. Applies to every property.</small>
        </label>
      </div>
    </form>

    <div className={styles.pageHeader}>
      <div>
        <h2>Applicants</h2>
        <p className="muted">{applications.length === 0 ? 'No applications yet.' : `${visible.length} application${visible.length === 1 ? '' : 's'} in ${groups.size} group${groups.size === 1 ? '' : 's'}.`}</p>
      </div>
      <div className={styles.headerActions}>
        {archivedCount > 0 && <Link className="btn btn-ghost btn-sm" href={toggleHref} aria-pressed={hideArchived}>{hideArchived ? 'Show archived' : 'Hide archived'}</Link>}
        <Button href={`/leases/new${scope.unitId ? `?unit=${encodeURIComponent(scope.unitId)}` : ''}`} variant="primary" size="sm">Create lease</Button>
      </div>
    </div>

    {visible.length === 0 ? <div className={`card ${styles.emptyCard}`}>
      <strong>{applications.length === 0 ? 'No applications yet' : 'Nothing active'}</strong>
      <p className="muted">{applications.length === 0 ? 'Applications for this property will appear here.' : 'Only archived applications are left. Show archived to see them.'}</p>
    </div> : <div className={styles.groups}>{[...groups.values()].map((group) => {
      const status = group.status;
      const approved = group.items.find((a) => a.status === 'APPROVED');
      return <article className="card" key={group.key} aria-label={`${group.label} applications`} data-application-group={group.key}>
        <div className={styles.groupHead}>
          <div>
            <h3>{group.label}</h3>
            <small className="muted">{group.items.length} applicant{group.items.length === 1 ? '' : 's'} · latest {date(group.items[0].appliedAt)}</small>
          </div>
          <Badge tone={tones[status]}>{labels[status]}</Badge>
        </div>
        <ul className={styles.pills}>{group.items.map((application) => <li key={application.id}>
          <Link href={reviewHref(application.id)} className={styles.pill} data-status={application.status} title={`${application.applicantEmail} · applied ${date(application.appliedAt)}`}>
            <span className={styles.pillDot} aria-hidden="true" />
            {application.applicantName}
            <small>{labels[application.status as ApplicationStatus]}</small>
          </Link>
        </li>)}</ul>
        {approved && <div className={styles.groupActions}><Link className="btn btn-primary btn-sm" href={leaseHref(group.unitId, approved.id)}>Create lease →</Link></div>}
      </article>;
    })}</div>}
  </section>;
}
