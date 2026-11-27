'use client';

import { createContext, useContext, useEffect } from 'react';
import type { ManagerAction } from './nav';

export type PageHeaderConfig = {
  title?: string;
  /** One short line under the title: "Whole property · Revision 0 · Unsaved changes". */
  meta?: string;
  /** Back link rendered above the title. */
  back?: { href: string; label: string };
  actions?: ManagerAction[];
};

export type Setter = (config: PageHeaderConfig | null) => void;

export const PageHeaderContext = createContext<Setter>(() => {});

/** Render inside a manager page to set its own topbar title, meta line, back link and actions. */
export function PageHeader({ title, meta, back, actions }: PageHeaderConfig) {
  const set = useContext(PageHeaderContext);
  const key = JSON.stringify(actions ?? null);
  const backKey = JSON.stringify(back ?? null);
  useEffect(() => {
    set({
      title,
      meta,
      back: backKey === 'null' ? undefined : JSON.parse(backKey),
      actions: key === 'null' ? undefined : JSON.parse(key),
    });
    return () => set(null);
  }, [set, title, meta, key, backKey]);
  return null;
}
