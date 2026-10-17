import { LeasesPanel, tabScope } from '@/components/workspace/panels/leasing';
import { requireManagerRole } from '@/lib/auth/access';
import { first, type WorkspaceSearch } from '../routing';

export default async function PropertyLeasesPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [session, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  return <LeasesPanel organizationId={session.organizationId} scope={tabScope(id, query)} page={first(query.page)} />;
}
