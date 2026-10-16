import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { documentsDestination, type WorkspaceSearch } from '../routing';

export default async function PropertyDocumentsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<WorkspaceSearch>;
}) {
  const [, { id }, query] = await Promise.all([requireManagerRole(), params, searchParams]);
  redirect(documentsDestination(id, query));
}
