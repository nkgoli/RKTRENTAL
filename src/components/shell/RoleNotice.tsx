'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function RoleNotice({ role }: { role: 'tenant' | 'manager' }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(new URLSearchParams(window.location.search).get('notice') === 'role');
  }, [pathname]);
  if (!visible) return null;
  return (
    <div className="alert row between" role="status">
      <p>
        {role === 'tenant'
          ? "That page is for property managers. You're signed in as a tenant."
          : "That page is for tenants. You're signed in as a property manager."}
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Dismiss account notice"
        onClick={() => {
          setVisible(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('notice');
          window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
