import type { ReactNode } from 'react';
import { TenantShell } from '@/components/shell/TenantShell';
import { getSession } from '@/lib/auth/server-session';
import { initials, unitLabel } from '@/lib/properties/format';
import { findTenantLeaseForPortal } from '@/lib/tenant-portal';

export default async function TenantLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const lease =
    session?.role === 'TENANT' && session.tenantId ? await findTenantLeaseForPortal(session) : null;
  return (
    <TenantShell
      initials={session ? initials(session.name) : undefined}
      name={session?.name}
      premises={lease ? unitLabel(lease.unit.property, lease.unit) : undefined}
    >
      {children}
    </TenantShell>
  );
}
