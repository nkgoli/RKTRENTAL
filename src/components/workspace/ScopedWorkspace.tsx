import { loadWorkspaceScope, type ScopeFilter } from '@/lib/workspace/scope';
import { Workspace, type WorkspaceTab } from './Workspace';

/** Workspace header and tabs for a page opened in a property or unit scope; nothing when unscoped. */
export async function ScopedWorkspace({
  organizationId,
  filter,
  activeTab,
}: {
  organizationId: string;
  filter: ScopeFilter;
  activeTab: WorkspaceTab;
}) {
  const scope = await loadWorkspaceScope(organizationId, filter);
  return scope ? <Workspace scope={scope} activeTab={activeTab} /> : null;
}
