import { WorkspacePlaceholder } from '@/components/workspace/WorkspacePlaceholder';
import { first, type WorkspaceSearch } from '../routing';

export default async function PropertyApplicationsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <WorkspacePlaceholder section="Applications" propertyId={id} unitId={first(query.unit)} />;
}
