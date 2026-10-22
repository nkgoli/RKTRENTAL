import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { loadWorkspaceScope, scopeFilterFrom, scopeQuery } from '@/lib/workspace/scope';
import { PageHeader } from '@/components/shell/PageHeader';
import { ReminderWorkspace } from '@/components/notifications/ReminderWorkspace';
import { loadReminderChannels, loadReminderChoices } from '@/components/notifications/server';

export const dynamic = 'force-dynamic';

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [actor, query] = await Promise.all([requireManagerRole(), searchParams]);
  const scope = scopeFilterFrom(query);
  const workspace =
    scope.propertyId || scope.unitId ? await loadWorkspaceScope(actor.organizationId, scope) : null;
  if ((scope.propertyId || scope.unitId) && !workspace) notFound();
  const [choices, channels] = await Promise.all([
    loadReminderChoices(actor.organizationId, scope),
    loadReminderChannels(actor.organizationId),
  ]);
  const leaseId = typeof query.leaseId === 'string' ? query.leaseId : undefined;
  const tenantId = typeof query.tenantId === 'string' ? query.tenantId : undefined;
  const fromRentRoll = query.from === 'rent-roll';
  // Opened from a rent-roll row menu: return to the late rent roll in the same scope.
  const rentRollQuery = scopeQuery(scope);
  rentRollQuery.set('filter', 'late');
  const returnHref = fromRentRoll
    ? `/payments?${rentRollQuery}`
    : workspace
      ? `/properties/${workspace.propertyId}${workspace.unitId ? `?unit=${workspace.unitId}` : ''}`
      : '/payments';
  return (
    <>
      <nav className="breadcrumbs" aria-label="Reminder scope">
        <Link href={returnHref}>
          {fromRentRoll
            ? 'Rent roll'
            : workspace
              ? `${workspace.propertyName}${workspace.unitNumber ? ` · Unit ${workspace.unitNumber}` : ''}`
              : 'Payments'}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Payment reminders</span>
      </nav>
      <PageHeader
        eyebrow="Collections"
        title="Payment reminders"
        meta="Preview, edit and send · recorded recipient outcomes"
        actions={[{ label: 'Payment reminder setup', href: '/integrations#payment-reminders' }]}
      />
      <ReminderWorkspace
        choices={choices}
        channels={channels}
        initialLeaseId={leaseId}
        initialTenantId={tenantId}
        fromRentRoll={fromRentRoll}
        historyFirst={query.view === 'history'}
        storageKey={`payment-reminder:${actor.organizationId}:${actor.subjectId}`}
      />
    </>
  );
}
