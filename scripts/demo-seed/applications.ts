import { ApplicationStatus, Prisma } from '@prisma/client';
import { fakePerson, pickInt, prng, type PlannedLease, type PlannedTenant, type PlannedUnit } from './plan';

const day = (date: Date, offset: number) => new Date(date.getTime() + offset * 86_400_000);
const organizationId = 'seed-rocket-rental';

export type PlannedApplicationGroup = {
  id: string;
  unitId: string;
  at: Date;
  nextLeaseId?: string;
  open: boolean;
  applicantIds: string[];
  status: ApplicationStatus;
  archivedAt: Date | null;
};

/** The furthest-along application speaks for its household. */
const statusRank: ApplicationStatus[] = ['APPROVED', 'REVIEW', 'SCREENING', 'SUBMITTED', 'DECLINED'];

export function planApplications(seed: number, now: Date, units: PlannedUnit[],
  leases: PlannedLease[], tenants: PlannedTenant[]) {
  const random = prng(seed ^ 0x61a47c3d);
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const byUnit = new Map<string, PlannedLease[]>();
  for (const lease of leases) byUnit.set(lease.unitId, [...(byUnit.get(lease.unitId) ?? []), lease]);
  const groups: PlannedApplicationGroup[] = [];
  const applications: Prisma.ApplicationCreateManyInput[] = [];
  const consents: Prisma.ScreeningConsentCreateManyInput[] = [];
  const reports: Prisma.ScreeningReportCreateManyInput[] = [];
  let personIndex = 10_000;

  function addGroup(unitId: string, key: string, at: Date, statuses: ApplicationStatus[],
    options: { nextLeaseId?: string; open?: boolean; tenant?: PlannedTenant; archived?: boolean } = {}) {
    const id = `demo-group-${key}`;
    // Nobody applies in the future: households for leases starting later applied last week or so,
    // early enough that their consent and decision dates are in the past too.
    const latest = day(now, -8);
    if (at > latest) at = day(latest, -(groups.length % 10));
    const group: PlannedApplicationGroup = { id, unitId, at, nextLeaseId: options.nextLeaseId,
      open: options.open ?? false, applicantIds: [],
      status: statusRank.find((candidate) => statuses.includes(candidate)) ?? 'SUBMITTED',
      archivedAt: options.archived ? day(at, 30) : null };
    for (const [index, status] of statuses.entries()) {
      const person = options.tenant ?? fakePerson(random, ++personIndex);
      const applicationId = `${id}-applicant-${index + 1}`;
      group.applicantIds.push(applicationId);
      const decided = status === 'APPROVED' || status === 'DECLINED';
      applications.push({ id: applicationId, organizationId, unitId,
        applicationGroupId: id, applicantName: person.name, applicantEmail: person.email, status, appliedAt: at,
        createdAt: at,
        ...(decided ? { decidedAt: day(at, 7), decidedBy: 'Jordan Mills',
          decisionReason: status === 'APPROVED' ? 'Demo household selected for next lease'
            : 'Demo household not selected' } : {}) });
      if (status !== 'SUBMITTED') consents.push({ id: `demo-consent-${applicationId}`,
        organizationId, applicationId, provider: 'demo-screening', consentedAt: day(at, 1),
        consentVersion: 'demo-1' });
      const reportStatus = options.archived ? 'archived' : status === 'SUBMITTED' ? 'invited'
        : status === 'SCREENING' ? 'in_progress' : 'completed';
      reports.push({ id: `demo-report-${applicationId}`, organizationId, applicationId,
        provider: 'demo-screening', providerReference: `demo-screening:${applicationId}`,
        status: reportStatus,
        summary: reportStatus === 'invited' || reportStatus === 'in_progress' ? Prisma.JsonNull
          : { creditScore: 640 + personIndex % 120, background: 'clear', eviction: 'clear' },
        completedAt: reportStatus === 'invited' || reportStatus === 'in_progress' ? null : day(at, 5),
        createdAt: at });
    }
    groups.push(group);
  }

  for (const unit of units) {
    const terms = (byUnit.get(unit.id) ?? []).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    for (const lease of terms) {
      if (lease.renewal) continue;
      const at = day(lease.startDate, -21);
      const tenant = tenantById.get(lease.tenantId);
      if (!tenant) throw new Error(`Missing tenant for ${lease.id}`);
      // A selected household mirrors the next lease's complete tenant membership (one in this portfolio).
      addGroup(unit.id, `${lease.id}-approved`, at, ['APPROVED'], { nextLeaseId: lease.id, tenant });
      const older = lease.startDate < day(now, -730);
      const otherStatus: ApplicationStatus = older ? 'DECLINED'
        : (lease.cycle % 3 === 0 ? 'DECLINED' : lease.cycle % 3 === 1 ? 'REVIEW' : 'SCREENING');
      addGroup(unit.id, `${lease.id}-other`, day(at, -3),
        Array.from({ length: pickInt(random, 1, 3) }, () => otherStatus),
        { nextLeaseId: lease.id, archived: older });
    }
    const active = terms.find((lease) => lease.startDate <= now && lease.endDate >= now);
    const soon = active && active.endDate <= day(now, 90);
    if (!active || soon) {
      const at = active ? day(active.endDate, -30) : day(now, -pickInt(random, 1, 20));
      const key = active ? `${active.id}-upcoming` : `${unit.id}-vacant`;
      const count = pickInt(random, 1, 3);
      addGroup(unit.id, key, at, Array.from({ length: count }, (_, index) =>
        index % 2 === 0 ? 'SUBMITTED' : 'SCREENING'), { open: true });
    }
  }
  return { groups, applications, consents, reports };
}
