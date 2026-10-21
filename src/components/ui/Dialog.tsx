'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../shell/Icons';
import { cx } from './cx';

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
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      const target =
        el.querySelector<HTMLElement>('[autofocus]') ??
        el.querySelector<HTMLElement>('input, select, textarea') ??
        el.querySelector<HTMLElement>('.dialog-close');
      target?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx('dialog', `dialog-${size}`, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
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
        <button type="button" className="icon-btn dialog-close" aria-label="Close" onClick={onClose}>
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
