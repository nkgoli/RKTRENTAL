'use client';

import { createContext, useContext, useEffect } from 'react';
import type { ManagerAction } from './nav';

export type PageHeaderConfig = {
  title?: string;
  eyebrow?: string;
  actions?: ManagerAction[];
};

export type Setter = (config: PageHeaderConfig | null) => void;

export const PageHeaderContext = createContext<Setter>(() => {});

/** Render inside a manager page to set its own topbar title, eyebrow and actions. */
export function PageHeader({ title, eyebrow, actions }: PageHeaderConfig) {
  const set = useContext(PageHeaderContext);
  const key = JSON.stringify(actions ?? null);
  useEffect(() => {
    set({ title, eyebrow, actions: key === 'null' ? undefined : JSON.parse(key) });
    return () => set(null);
  }, [set, title, eyebrow, key]);
  return null;
}
