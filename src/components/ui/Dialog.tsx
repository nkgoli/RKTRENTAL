'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../shell/Icons';
import { cx } from './cx';

const FOCUSABLE =
  'a[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]';

function isAvailable(control: HTMLElement) {
  if (control.matches(':disabled, input[type="hidden"]') || control.closest('[hidden], [inert]'))
    return false;
  const visibility = getComputedStyle(control).visibility;
  if (visibility === 'hidden' || visibility === 'collapse') return false;
  for (let ancestor: HTMLElement | null = control; ancestor; ancestor = ancestor.parentElement) {
    if (getComputedStyle(ancestor).display === 'none') return false;
    if (
      ancestor instanceof HTMLDetailsElement &&
      !ancestor.open &&
      !ancestor.querySelector(':scope > summary')?.contains(control)
    )
      return false;
  }
  return true;
}

/**
 * Shared modal shell on the native `<dialog>`: title row with an icon close, scrollable body,
 * optional footer. Escape and a backdrop click call `onClose`; focus goes to the first
 * `[autofocus]` control, else the first field, else the close button; the browser restores
 * focus to the opener when the dialog closes.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = 'md',
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
      const firstAvailable = (selector: string) =>
        Array.from(el.querySelectorAll<HTMLElement>(selector)).find(isAvailable);
      const target =
        firstAvailable('[data-autofocus], [autofocus]') ??
        firstAvailable('input, select, textarea') ??
        el.querySelector<HTMLElement>('.dialog-close');
      target?.focus();
    } else if (!open && el.open) {
      el.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el?.open) {
        el.close();
        if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={cx('dialog', `dialog-${size}`, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={(event) => {
        if (
          event.key !== 'Tab' ||
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((control) => control.tabIndex >= 0 && isAvailable(control));
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (
          !controls.includes(active as HTMLElement) ||
          (event.shiftKey ? active === first : active === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          className="icon-btn dialog-close"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">
        {description && (
          <p id={descriptionId} className="dialog-description">
            {description}
          </p>
        )}
        {children}
      </div>
      {footer && <div className="dialog-foot">{footer}</div>}
    </dialog>
  );
}
