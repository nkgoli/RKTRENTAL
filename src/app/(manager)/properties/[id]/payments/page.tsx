import { PaymentsPanel, tabScope } from '@/components/workspace/panels/leasing';
import { requireManagerRole } from '@/lib/auth/access';
import { first, type WorkspaceSearch } from '../routing';

export const dynamic = 'force-dynamic';

export default async function PropertyPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  const scope = tabScope(id, query);
  return (
    <PaymentsPanel
      organizationId={session.organizationId}
      scope={scope}
      recording={first(query.record) !== undefined}
      notice={first(query.notice)}
      remindersHref={`/notifications?propertyId=${id}${scope.unitId ? `&unitId=${scope.unitId}` : ''}`}
    />
  );
}
