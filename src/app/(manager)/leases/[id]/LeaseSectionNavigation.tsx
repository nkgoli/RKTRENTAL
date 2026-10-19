'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Keep the selected lease section visible when the mobile tab row overflows. */
export function LeaseSectionNavigation({
  activeTab,
  className,
  children,
}: {
  activeTab: string;
  className: string;
  children: ReactNode;
}) {
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const revealCurrent = () => {
      const current = nav.querySelector<HTMLAnchorElement>('[aria-current="page"]');
      if (!current) return;
      const viewport = nav.getBoundingClientRect();
      const item = current.getBoundingClientRect();
      if (item.left < viewport.left) nav.scrollLeft += item.left - viewport.left - 4;
      else if (item.right > viewport.right) nav.scrollLeft += item.right - viewport.right + 4;
    };
    revealCurrent();
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeTab]);

  return (
    <nav ref={navigation} className={className} aria-label="Lease sections">
      {children}
    </nav>
  );
}
