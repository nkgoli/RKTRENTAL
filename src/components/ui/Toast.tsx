'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from './cx';

export type ToastTone = 'success' | 'error' | 'info';
export type ToastInput = {
  message: string;
  tone?: ToastTone;
  /** Optional link shown after the message ("View", "Undo"). */
  action?: { label: string; href: string };
  /** Milliseconds before auto-dismiss; errors stay until dismissed. */
  duration?: number;
};
type ToastItem = ToastInput & { id: number };

type ToastApi = {
  push: (toast: ToastInput) => void;
  success: (message: string, action?: ToastInput['action']) => void;
  error: (message: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi>({
  push: () => {},
  success: () => {},
  error: () => {},
  dismiss: () => {},
});

const MAX_VISIBLE = 3;
const DEFAULT_MS = 4000;

/** Mount once per shell; renders the toast region bottom-left (above the tenant tab bar). */
export function ToastProvider({ children, offset }: { children: ReactNode; offset?: 'tabbar' }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setItems((list) => [...list, { ...toast, id }].slice(-MAX_VISIBLE));
      const duration = toast.duration ?? (toast.tone === 'error' ? 0 : DEFAULT_MS);
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (message, action) => push({ message, tone: 'success', action }),
      error: (message) => push({ message, tone: 'error' }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={cx('toaster', offset === 'tabbar' && 'toaster-tabbar')}>
        {items.map((item) => (
          <div
            key={item.id}
            className={cx('toast', item.tone && item.tone !== 'info' && item.tone)}
            role={item.tone === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-dot" aria-hidden="true" />
            <span className="toast-text">{item.message}</span>
            {item.action && (
              <a className="toast-action" href={item.action.href}>
                {item.action.label}
              </a>
            )}
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/**
 * For server-rendered pages that report a result through the URL (`?notice=`): render this with
 * the resolved message; it shows the toast once and strips the result params from the address
 * bar so a reload does not repeat it.
 */
export function NoticeToast({
  message,
  tone = 'success',
  params = ['notice', 'toast', 'error', 'saved'],
  action,
}: {
  message: string;
  tone?: ToastTone;
  params?: string[];
  action?: ToastInput['action'];
}) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!message || shown.current === message) return;
    shown.current = message;
    toast.push({ message, tone, action });
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    let changed = false;
    for (const name of params) {
      if (url.searchParams.has(name)) {
        url.searchParams.delete(name);
        changed = true;
      }
    }
    if (changed) {
      const query = url.searchParams.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}${url.hash}`, { scroll: false });
    }
  }, [message, tone, action, params, toast, router, pathname]);
  return null;
}
