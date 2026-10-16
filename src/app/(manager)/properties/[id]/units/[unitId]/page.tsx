import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { first, legacyTabDestination, type WorkspaceSearch } from '../../routing';

export default async function LegacyUnitPage({ params, searchParams }: {
  params: Promise<{ id: string; unitId: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [, { id, unitId }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  // The destination checks that the unit belongs to this property and organization.
  redirect(legacyTabDestination(id, { ...query, tab: first(query.tab) ?? 'overview' }, unitId));
}
