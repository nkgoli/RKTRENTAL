import { PaymentsPanel, tabScope } from '@/components/workspace/panels/leasing';
import { requireManagerRole } from '@/lib/auth/access';
import { first, type WorkspaceSearch } from '../routing';
import Link from 'next/link';

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
    <>
      <p>
        <Link
          className="btn btn-secondary"
          href={`/notifications?propertyId=${id}${scope.unitId ? `&unitId=${scope.unitId}` : ''}`}
        >
          Payment reminders &amp; history
        </Link>
      </p>
      <PaymentsPanel
        organizationId={session.organizationId}
        scope={scope}
        recording={first(query.record) !== undefined}
        notice={first(query.notice)}
      />
    </>
  );
}
