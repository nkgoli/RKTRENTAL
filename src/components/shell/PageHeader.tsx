'use client';

import { createContext, useContext, useEffect } from 'react';
import type { ManagerAction } from './nav';

export type PageHeaderConfig = {
  title?: string;
  eyebrow?: string;
  /** One 13px line under the title: "Whole property · Revision 0 · Unsaved changes". */
  meta?: string;
  /** Breadcrumb-style back link rendered in the eyebrow row. */
  back?: { href: string; label: string };
  actions?: ManagerAction[];
};

export type Setter = (config: PageHeaderConfig | null) => void;

export const PageHeaderContext = createContext<Setter>(() => {});

/** Render inside a manager page to set its own topbar title, eyebrow, meta line, back link and actions. */
export function PageHeader({ title, eyebrow, meta, back, actions }: PageHeaderConfig) {
  const set = useContext(PageHeaderContext);
  const key = JSON.stringify(actions ?? null);
  const backKey = JSON.stringify(back ?? null);
  useEffect(() => {
    set({
      title,
      eyebrow,
      meta,
      back: backKey === 'null' ? undefined : JSON.parse(backKey),
      actions: key === 'null' ? undefined : JSON.parse(key),
    });
    return () => set(null);
  }, [set, title, eyebrow, meta, key, backKey]);
  return null;
}
