import type { ReactNode } from 'react';
import { ManagerShell } from '@/components/shell/ManagerShell';
import { getSession } from '@/lib/auth/server-session';
import { initials } from '@/lib/properties/format';

const ROLE_LABEL: Record<string, string> = {
  MANAGER: 'Property manager',
  OWNER: 'Owner',
  ADMIN: 'Administrator',
};

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const user = session
    ? {
        name: session.name,
        role: ROLE_LABEL[session.role] ?? 'Property manager',
        initials: initials(session.name),
      }
    : undefined;
  return <ManagerShell user={user}>{children}</ManagerShell>;
}
