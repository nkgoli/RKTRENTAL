'use client';

import { useEffect, useState } from 'react';

/** The focused builder covers the manager chrome; keep that chrome out of keyboard navigation. */
export function useBuilderShell() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const covered = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#manager-sidebar, .topbar, .skip, a[href="#main-content"]',
      ),
    );
    const previous = covered.map((element) => element.inert);
    const overflow = document.body.style.overflow;
    covered.forEach((element) => {
      element.inert = true;
    });
    document.body.style.overflow = 'hidden';
    setHydrated(true);
    return () => {
      covered.forEach((element, index) => {
        element.inert = previous[index];
      });
      document.body.style.overflow = overflow;
    };
  }, []);
  return hydrated;
}
