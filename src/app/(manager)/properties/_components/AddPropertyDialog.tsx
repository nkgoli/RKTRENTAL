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
    if (wantsOpen && !dialog.open) dialog.showModal();
  }, [wantsOpen]);

  function onClose() {
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
      onClick={(ev) => {
        if (ev.target === ref.current) ref.current?.close();
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
          ✕
        </button>
      </div>
      <AddPropertyForm owners={owners} onCancel={() => ref.current?.close()} />
    </dialog>
  );
}
