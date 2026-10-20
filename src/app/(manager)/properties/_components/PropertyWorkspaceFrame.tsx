'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Full edit pages use the manager shell without the overview's property tabs. */
export function PropertyWorkspaceFrame({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const editing = usePathname().endsWith('/edit');
  return (
    <>
      {!editing && header}
      {children}
    </>
  );
}
