import Link from 'next/link';
import {
  applicationStatusLabels as labels,
  applicationStatusTone,
} from '@/app/(manager)/applications/status';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Pagination, pageFrom, paginate } from '@/components/ui/Pagination';
import { db } from '@/lib/db/client';
import { ApplicationArrow } from '@/app/(manager)/applications/ApplicationArrow';
import type { ApplicationStatus } from '@/lib/screening/policy';
import { unitScopeWhere, scopeQuery, type ScopeFilter } from '@/lib/workspace/scope';
import { withUnit } from './scope';
import styles from './leasing.module.css';
import ux from './applications-ux.module.css';
import { InvitationList } from '@/components/applications/InvitationList';

const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  'settings-saved': { tone: 'success', text: 'Application settings saved.' },
  'settings-invalid': { tone: 'warning', text: 'Those screening settings are not supported.' },
};
const date = (value: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);

/** Applications for one property (and optionally one unit), grouped by household; applicants open the existing review page. */
export async function ApplicationsPanel({
  organizationId,
  scope,
  hideArchived = false,
  notice,
  page,
}: {
  organizationId: string;
  scope: ScopeFilter;
  /** Archived households (archivedAt set) are closed out and no longer in play. */
  hideArchived?: boolean;
  notice?: string;
  page?: string;
}) {
  const applications = await db.application.findMany({
    where: { organizationId, ...unitScopeWhere(scope) },
    include: { unit: true, applicationGroup: true },
    orderBy: { appliedAt: 'desc' },
  });
  const archivedCount = new Set(
    applications.filter((a) => a.applicationGroup?.archivedAt).map((a) => a.applicationGroupId),
  ).size;
  const visible = hideArchived
    ? applications.filter((a) => !a.applicationGroup?.archivedAt)
    : applications;

  // An application without a household is its own group.
  type Group = {
    key: string;
    unitId: string;
    label: string;
    status: ApplicationStatus;
    items: typeof applications;
  };
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
    return `/applications?${query}#selected-applicant`;
  };
  const leaseHref = (unitId: string, tenantId: string) =>
    `/leases/new?${new URLSearchParams({ unit: unitId, tenant: tenantId })}`;
  const toggleHref = withUnit(
    `/properties/${scope.propertyId}/applications`,
    scope.unitId,
    hideArchived ? {} : { hideArchived: '1' },
  );
  const message = notice ? notices[notice] : undefined;
  const allGroups = [...groups.values()];
  const current = pageFrom(page, allGroups.length);
  const pageHref = (n: number) =>
    withUnit(`/properties/${scope.propertyId}/applications`, scope.unitId, {
      ...(hideArchived ? { hideArchived: '1' } : {}),
      ...(n > 1 ? { page: String(n) } : {}),
    });

  return (
    <section className={`${styles.panel} ${ux.panel}`} aria-label="Applications">
      {message && (
        <Alert tone={message.tone}>
          <div>{message.text}</div>
        </Alert>
      )}
      <Link className="link-row" href="/integrations#screening-providers">
        <span>
          <strong>Application settings</strong>
          <small className="muted">Organization-wide screening defaults</small>
        </span>
        <ApplicationArrow />
      </Link>

      <div className={`${styles.pageHeader} ${ux.pageHeader}`}>
        <div>
          <h2>Applicants</h2>
          <p className="muted">
            {applications.length === 0
              ? 'No applications yet.'
              : `${visible.length} application${visible.length === 1 ? '' : 's'} in ${groups.size} group${groups.size === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div className={styles.headerActions}>
          {archivedCount > 0 && (
            <Link className="btn btn-ghost btn-sm" href={toggleHref} aria-pressed={hideArchived}>
              {hideArchived ? 'Show archived' : 'Hide archived'}
            </Link>
          )}
          <Button
            href={`/leases/new?${new URLSearchParams({ property: scope.propertyId!, ...(scope.unitId ? { unit: scope.unitId } : {}) })}`}
            variant="primary"
            size="sm"
          >
            Create lease
          </Button>
        </div>
      </div>

      {await InvitationList({ organizationId, scope })}

      {visible.length === 0 ? (
        <div className={`card ${styles.emptyCard}`}>
          <strong>{applications.length === 0 ? 'No applications yet' : 'Nothing active'}</strong>
          <p className="muted">
            {applications.length === 0
              ? scope.unitId
                ? 'Applications for this unit will appear here. Choose All units to review the whole property.'
                : 'Applications for this property will appear here.'
              : 'Only archived applications are left. Show archived to see them.'}
          </p>
        </div>
      ) : (
        <div className="card flush">
          <ul className={`${styles.groups} ${ux.groups}`}>
            {paginate(allGroups, current).map((group) => {
              const status = group.status;
              const approved = group.items.find(
                (a) => a.status === 'APPROVED' && a.promotedTenantId,
              );
              return (
                <li
                  className={`${styles.groupRow} ${ux.groupRow}`}
                  key={group.key}
                  aria-label={`${group.label} applications`}
                  data-application-group={group.key}
                >
                  <div className={styles.groupHead}>
                    <h3>
                      <Link
                        href={`/properties/${scope.propertyId}?unit=${encodeURIComponent(group.unitId)}`}
                      >
                        {group.items.map((item) => item.applicantName).join(' & ')} · {group.label}
                      </Link>
                    </h3>
                    <small className="muted">
                      {group.items.length > 1 ? `${group.items.length} applicants · ` : ''}Applied{' '}
                      {date(group.items[0].appliedAt)}
                    </small>
                  </div>
                  <ul className={`${styles.pills} ${ux.people}`}>
                    {group.items.map((application) => (
                      <li key={application.id}>
                        <Link
                          href={reviewHref(application.id)}
                          className={`${styles.pill} ${ux.person}`}
                          data-status={application.status}
                          title={`${application.applicantEmail} · applied ${date(application.appliedAt)}`}
                        >
                          <span className={styles.pillDot} aria-hidden="true" />
                          <span>
                            {application.applicantName}
                            <small className={ux.email}>{application.applicantEmail}</small>
                          </span>
                          {/* The row badge already states the household status; only a different one is shown here. */}
                          {application.status !== status && (
                            <small>{labels[application.status as ApplicationStatus]}</small>
                          )}
                        </Link>
                        {application.promotedTenantId ? (
                          <Link
                            href={`/tenants/${encodeURIComponent(application.promotedTenantId)}`}
                          >
                            View tenant
                          </Link>
                        ) : application.status === 'APPROVED' ? (
                          <Link href={reviewHref(application.id)}>Promote to tenant</Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className={`${styles.groupActions} ${ux.groupActions}`}>
                    <Badge tone={applicationStatusTone(status)}>{labels[status]}</Badge>
                    {approved?.promotedTenantId && (
                      <Link
                        className="btn btn-primary btn-sm"
                        href={leaseHref(group.unitId, approved.promotedTenantId)}
                      >
                        Create lease <ApplicationArrow />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={current} total={allGroups.length} noun="households" href={pageHref} />
        </div>
      )}
    </section>
  );
}
