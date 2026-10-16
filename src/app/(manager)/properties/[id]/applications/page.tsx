import { ApplicationsPanel, tabScope } from '@/components/workspace/panels/leasing';
import { requireManagerRole } from '@/lib/auth/access';
import type { WorkspaceSearch } from '../routing';

export default async function PropertyApplicationsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  return <ApplicationsPanel organizationId={session.organizationId} scope={tabScope(id, query)} />;
}
