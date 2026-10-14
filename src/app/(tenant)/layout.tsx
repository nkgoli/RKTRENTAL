import type { ReactNode } from 'react';
import { TenantShell } from '@/components/shell/TenantShell';

export default function TenantLayout({ children }: { children: ReactNode }) {
  return <TenantShell>{children}</TenantShell>;
}
