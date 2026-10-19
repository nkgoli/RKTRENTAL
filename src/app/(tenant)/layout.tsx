import type { ReactNode } from 'react';
import { TenantShell } from '@/components/shell/TenantShell';
import { getSession } from '@/lib/auth/server-session';
import { initials } from '@/lib/properties/format';

export default async function TenantLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <TenantShell initials={session ? initials(session.name) : undefined}>{children}</TenantShell>
  );
}
