import type { CoverKind } from '@/components/ui';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceTabs } from './WorkspaceTabs';

export type WorkspaceTab = 'overview' | 'listing' | 'applications' | 'leases' | 'payments' | 'returns' | 'maintenance' | 'documents';

export type WorkspaceScope = {
  propertyId: string;
  propertyName: string;
  propertyType: string;
  propertyArchived?: boolean;
  propertyAddress?: string;
  activeUnitCount?: number;
  unitId?: string;
  unitNumber?: string;
  unitIsImplicit?: boolean;
  unitStatus?: string;
};

export type WorkspaceUnit = { id: string; number: string; isImplicit: boolean; status: string };
export type WorkspaceAction = { label: string; href: string; primary?: boolean };

export function Workspace({ scope, units = [], activeTab, coverKind, coverSrc }: {
  scope: WorkspaceScope;
  units?: WorkspaceUnit[];
  activeTab?: WorkspaceTab;
  coverKind?: CoverKind;
  coverSrc?: string;
}) {
  return <>
    <WorkspaceHeader scope={scope} units={units} coverKind={coverKind} coverSrc={coverSrc} />
    <WorkspaceTabs propertyId={scope.propertyId} unitId={scope.unitId} activeTab={activeTab} />
  </>;
}
