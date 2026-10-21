'use client';

import { useState, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { Dialog } from './Dialog';
import type { IconKey } from '../shell/Icons';

export type ConfirmTone = 'danger' | 'primary';

/**
 * The one confirmation pattern for destructive or irreversible actions: 440px dialog, the object
 * named in the title, consequences in the description, Cancel focused first, outlined danger
 * confirm. Pass `onConfirm` for client handlers, or `action` plus hidden fields so the confirm
 * button submits a server action directly.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  confirmLabel,
  tone = 'danger',
  pending,
  onConfirm,
  action,
  fields,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  tone?: ConfirmTone;
  pending?: boolean;
  onConfirm?: () => void;
  /** Server action submitted by the confirm button. */
  action?: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs posted with `action`. */
  fields?: Record<string, string | undefined>;
  /** Optional extra inputs (a date, a note) shown above the footer. */
  children?: ReactNode;
}) {
  const formId = 'confirm-' + (typeof title === 'string' ? title : 'dialog').replace(/\W+/g, '-');
  const confirm = (
    <Button
      type={action ? 'submit' : 'button'}
      form={action ? formId : undefined}
      variant={tone === 'danger' ? 'danger' : 'primary'}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={action ? undefined : onConfirm}
    >
      {confirmLabel}
    </Button>
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      description={description}
      size="sm"
      className="dialog-confirm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} autoFocus disabled={pending}>
            Cancel
          </Button>
          {confirm}
        </>
      }
    >
      {action ? (
        <form id={formId} action={action} className="stack" style={{ gap: 12 }}>
          {Object.entries(fields ?? {}).map(([name, value]) =>
            value === undefined ? null : (
              <input key={name} type="hidden" name={name} value={value} />
            ),
          )}
          {children}
        </form>
      ) : (
        children
      )}
    </Dialog>
  );
}

/**
 * A button that opens a ConfirmDialog and submits `action` when confirmed. The common case for
 * server-rendered pages: Refund, Terminate, Remove photo, Delete document, Record move-out.
 */
export function ConfirmButton({
  label,
  icon,
  variant = 'secondary',
  size,
  block,
  className,
  title,
  eyebrow,
  description,
  confirmLabel,
  tone = 'danger',
  action,
  fields,
  children,
  disabled,
}: {
  label: ReactNode;
  icon?: IconKey;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
  className?: string;
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  tone?: ConfirmTone;
  action: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string | undefined>;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        block={block}
        className={className}
        icon={icon}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        eyebrow={eyebrow}
        description={description}
        confirmLabel={confirmLabel}
        tone={tone}
        action={action}
        fields={fields}
      >
        {children}
      </ConfirmDialog>
    </>
  );
}
