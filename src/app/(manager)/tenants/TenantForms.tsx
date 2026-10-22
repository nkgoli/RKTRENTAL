'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button, Card, Field, FormRow, Input, ConfirmButton, cx } from '@/components/ui';
import type { FormState } from './actions';
import styles from './tenants.module.css';

const empty: FormState = { errors: {} };

function useErrorFocus(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (Object.keys(state.errors).length)
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return ref;
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <span id={id} className={styles.error} role="alert">
      {message}
    </span>
  ) : null;
}

export function AddNoteForm({
  action,
  returnTo,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, empty);
  const formRef = useErrorFocus(state);
  return (
    <form
      ref={formRef}
      className="form"
      action={formAction}
      key={state.message ?? 'note'}
      noValidate
    >
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {state.message && !Object.keys(state.errors).length && (
        <div className="alert success" role="status">
          {state.message}
        </div>
      )}
      <Field label="Add a note">
        <textarea
          name="body"
          aria-invalid={Boolean(state.errors.body)}
          aria-describedby={state.errors.body ? 'note-body-error' : undefined}
          aria-label="Note"
          rows={3}
          maxLength={2000}
          placeholder="Called about the parking permit…"
          defaultValue={state.values?.body}
        />
        <FieldError id="note-body-error" message={state.errors.body} />
      </Field>
      <div className={styles.formActions}>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save note'}
        </Button>
      </div>
    </form>
  );
}

export function EditTenantForm({
  tenant,
  action,
  cancelHref,
  returnTo,
}: {
  tenant: {
    name: string;
    email: string | null;
    phone: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelationship: string | null;
  };
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, empty);
  const formRef = useErrorFocus(state);
  const v = state.values ?? {};
  return (
    <Card id="edit-profile" className={cx(styles.tenantForm, styles.pad)}>
      <div className="card-header">
        <h2>Edit profile</h2>
      </div>
      <p className={styles.formHint}>
        Full name is required. Contact and emergency details are optional.
      </p>
      <form ref={formRef} className="form" action={formAction} noValidate aria-busy={pending}>
        <input type="hidden" name="returnTo" value={returnTo ?? ''} />
        {state.message && !Object.keys(state.errors).length && (
          <div className="alert warning" role="alert">
            {state.message}
          </div>
        )}
        <FormRow columns={3}>
          <Field label="Full name">
            <Input
              name="name"
              aria-invalid={Boolean(state.errors.name)}
              aria-describedby={state.errors.name ? 'edit-name-error' : undefined}
              defaultValue={v.name ?? tenant.name}
              required
            />
            <FieldError id="edit-name-error" message={state.errors.name} />
          </Field>
          <Field label="Email">
            <Input
              name="email"
              aria-invalid={Boolean(state.errors.email)}
              aria-describedby={state.errors.email ? 'edit-email-error' : undefined}
              type="email"
              defaultValue={v.email ?? tenant.email ?? ''}
            />
            <FieldError id="edit-email-error" message={state.errors.email} />
          </Field>
          <Field label="Phone">
            <Input
              name="phone"
              aria-invalid={Boolean(state.errors.phone)}
              aria-describedby={state.errors.phone ? 'edit-phone-error' : undefined}
              type="tel"
              defaultValue={v.phone ?? tenant.phone ?? ''}
            />
            <FieldError id="edit-phone-error" message={state.errors.phone} />
          </Field>
        </FormRow>
        <FormRow columns={3}>
          <Field label="Emergency contact">
            <Input
              name="emergencyContactName"
              aria-invalid={Boolean(state.errors.emergencyContactName)}
              aria-describedby={
                state.errors.emergencyContactName ? 'edit-emergencyContactName-error' : undefined
              }
              defaultValue={v.emergencyContactName ?? tenant.emergencyContactName ?? ''}
            />
            <FieldError
              id="edit-emergencyContactName-error"
              message={state.errors.emergencyContactName}
            />
          </Field>
          <Field label="Emergency contact phone">
            <Input
              name="emergencyContactPhone"
              aria-invalid={Boolean(state.errors.emergencyContactPhone)}
              aria-describedby={
                state.errors.emergencyContactPhone ? 'edit-emergencyContactPhone-error' : undefined
              }
              type="tel"
              defaultValue={v.emergencyContactPhone ?? tenant.emergencyContactPhone ?? ''}
            />
            <FieldError
              id="edit-emergencyContactPhone-error"
              message={state.errors.emergencyContactPhone}
            />
          </Field>
          <Field label="Relationship">
            <Input
              name="emergencyContactRelationship"
              aria-invalid={Boolean(state.errors.emergencyContactRelationship)}
              aria-describedby={
                state.errors.emergencyContactRelationship
                  ? 'edit-emergencyContactRelationship-error'
                  : undefined
              }
              defaultValue={
                v.emergencyContactRelationship ?? tenant.emergencyContactRelationship ?? ''
              }
            />
            <FieldError
              id="edit-emergencyContactRelationship-error"
              message={state.errors.emergencyContactRelationship}
            />
          </Field>
        </FormRow>
        <div className={styles.formActions}>
          <Button href={cancelHref} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Move-out confirmation. A native modal dialog supplies focus containment, Escape and
 * background inertness; Cancel receives focus first and the trigger is restored on close.
 */
export function MoveOutDialog({
  tenantName,
  unitLabel,
  leaseId,
  returnTo,
  action,
}: {
  tenantName: string;
  unitLabel: string;
  leaseId: string;
  returnTo: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <ConfirmButton
      label="Record move-out"
      title={`Move ${tenantName} out?`}
      eyebrow={unitLabel}
      description={`This ends the active lease today for everyone on it and marks ${unitLabel} vacant unless another active lease holds it. Tenant details, notes and payment history remain available.`}
      confirmLabel="Record move-out"
      action={action}
      fields={{ leaseId, returnTo }}
    />
  );
}
