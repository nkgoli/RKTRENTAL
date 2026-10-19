'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AddPropertyForm, type OwnerOption } from './PropertyForm';
import styles from '../properties.module.css';

/** "+ Add property" opens this dialog via `?add=1`; closing drops the param again. */
export function AddPropertyDialog({ owners }: { owners: OwnerOption[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wantsOpen = params.get('add') === '1';

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (wantsOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    }
    if (!wantsOpen && dialog.open) dialog.close();
    if (!wantsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [wantsOpen]);

  function onClose() {
    document.querySelector<HTMLAnchorElement>('a[href*="add=1"]')?.focus();
    if (!params.has('add')) return;
    const next = new URLSearchParams(params.toString());
    next.delete('add');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <dialog
      ref={ref}
      id="add-property"
      className={styles.dialog}
      aria-labelledby="add-property-heading"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const elements = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(ev) => {
        const dialog = ref.current;
        if (!dialog || ev.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (
          ev.clientX < box.left ||
          ev.clientX > box.right ||
          ev.clientY < box.top ||
          ev.clientY > box.bottom
        )
          dialog.close();
      }}
    >
      <div className={styles.dialogHeader}>
        <h2 id="add-property-heading">Add a property</h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
      </div>
      {wantsOpen && <AddPropertyForm owners={owners} onCancel={() => ref.current?.close()} />}
    </dialog>
  );
}
