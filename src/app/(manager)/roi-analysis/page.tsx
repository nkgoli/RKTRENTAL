import { loadAnalysisSelectionAction } from './actions';
import { RoiWorkspace } from '@/components/analysis/RoiWorkspace';

export const dynamic = 'force-dynamic';

export default async function RoiAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const [selection, params] = await Promise.all([loadAnalysisSelectionAction(), searchParams]);
  return <RoiWorkspace selection={selection} initialPropertyId={params.property} />;
}
