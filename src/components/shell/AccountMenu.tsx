'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signOutAction } from '@/app/(auth)/sign-out/actions';
import { Avatar } from '../ui/Badge';
import styles from './account-menu.module.css';

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-ghost btn-block" disabled={pending} aria-busy={pending}>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

export function AccountMenu({
  initials,
  name,
  description,
}: {
  initials: string;
  name?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return (
    <div
      className={styles.root}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        className={styles.trigger}
        onClick={() => setOpen(!open)}
      >
        <Avatar initials={initials} size="sm" />
      </button>
      {open && (
        <div className={styles.panel}>
          <div className={styles.identity}>
            <strong>{name ?? 'Your account'}</strong>
            {description && <small>{description}</small>}
          </div>
          <form action={signOutAction}>
            <SignOutButton />
          </form>
        </div>
      )}
    </div>
  );
}
