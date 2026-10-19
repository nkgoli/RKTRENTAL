'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { Badge, Button, Card, Field, FormRow, Input, Select, cx } from '@/components/ui';
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

export type PropertyOption = { id: string; name: string; units: { id: string; number: string }[] };

export function AddTenantForm({
  properties,
  action,
  initialPropertyId,
  returnTo,
}: {
  properties: PropertyOption[];
  initialPropertyId?: string;
  returnTo?: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, empty);
  const formRef = useErrorFocus(state);
  const v = state.values ?? {};
  const [propertyId, setPropertyId] = useState(v.propertyId ?? initialPropertyId ?? '');
  const [unitId, setUnitId] = useState(v.unitId ?? '');
  const units = properties.find((p) => p.id === propertyId)?.units ?? [];

  return (
    <Card id="add-tenant" className={cx(styles.tenantForm, styles.pad)}>
      <div className="card-header">
        <h2>Add tenant</h2>
        <Badge tone="info">New contact</Badge>
      </div>
      <p className={styles.formHint}>
        Full name is required. Add a contact now, or select a vacant unit to draft a lease.
      </p>
      <form ref={formRef} className="form" action={formAction} noValidate aria-busy={pending}>
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
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
              aria-describedby={state.errors.name ? 'add-name-error' : undefined}
              placeholder="Jamie Doe"
              defaultValue={v.name}
              required
            />
            <FieldError id="add-name-error" message={state.errors.name} />
          </Field>
          <Field label="Email">
            <Input
              name="email"
              aria-invalid={Boolean(state.errors.email)}
              aria-describedby={state.errors.email ? 'add-email-error' : undefined}
              type="email"
              placeholder="jamie@email.com"
              defaultValue={v.email}
            />
            <FieldError id="add-email-error" message={state.errors.email} />
          </Field>
          <Field label="Phone">
            <Input
              name="phone"
              aria-invalid={Boolean(state.errors.phone)}
              aria-describedby={state.errors.phone ? 'add-phone-error' : undefined}
              type="tel"
              placeholder="(555) 010-2030"
              defaultValue={v.phone}
            />
            <FieldError id="add-phone-error" message={state.errors.phone} />
          </Field>
        </FormRow>
        <FormRow columns={3}>
          <Field label="Property">
            <Select
              name="propertyId"
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUnitId('');
              }}
            >
              <option value="">No unit yet</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unit">
            <Select
              name="unitId"
              aria-invalid={Boolean(state.errors.unitId)}
              aria-describedby={state.errors.unitId ? 'add-unitId-error' : undefined}
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              key={propertyId}
              disabled={!propertyId || units.length === 0}
            >
              <option value="">
                {propertyId
                  ? units.length
                    ? 'Select a vacant unit'
                    : 'No vacant units available'
                  : 'Choose a property first'}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.number}
                </option>
              ))}
            </Select>
            <FieldError id="add-unitId-error" message={state.errors.unitId} />
          </Field>
          <Field label="Move-in date">
            <Input
              name="moveInDate"
              aria-invalid={Boolean(state.errors.moveInDate)}
              aria-describedby={state.errors.moveInDate ? 'add-moveInDate-error' : undefined}
              type="date"
              defaultValue={v.moveInDate}
            />
            <FieldError id="add-moveInDate-error" message={state.errors.moveInDate} />
          </Field>
        </FormRow>
        <div className={styles.formActions}>
          <p>Choosing a unit drafts a lease you can move the tenant into.</p>
          {unitId && (
            <Button href={`/leases/new?unit=${encodeURIComponent(unitId)}`} variant="secondary">
              Create lease
            </Button>
          )}
          <Button
            type="reset"
            variant="secondary"
            onClick={() => {
              setPropertyId('');
              setUnitId('');
            }}
          >
            Clear form
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save tenant'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function AddNoteForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const copyId = useId();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-danger btn-block"
        onClick={() => {
          dialogRef.current?.showModal();
          cancelRef.current?.focus();
        }}
      >
        Move out
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={headingId}
        aria-describedby={copyId}
        onClose={() => triggerRef.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            dialogRef.current?.close();
          }
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <p className={styles.eyebrow}>{unitLabel}</p>
        <h2 id={headingId}>Move {tenantName} out?</h2>
        <p id={copyId}>
          This ends the active lease today and marks {unitLabel} vacant unless another active lease
          holds it. Tenant details, notes and payment history remain available.
        </p>
        <p className="alert warning">
          This changes the lease for everyone on it. Review any co-tenants before continuing.
        </p>
        <form action={action} className={styles.dialogActions}>
          <input type="hidden" name="leaseId" value={leaseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button type="submit" className={cx('btn', styles.dangerSolid)}>
            Confirm move out
          </button>
        </form>
      </dialog>
    </>
  );
}
