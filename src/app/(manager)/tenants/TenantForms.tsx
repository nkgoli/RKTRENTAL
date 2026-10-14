'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Card, CardHeader, Field, FormRow, Input, Select } from '@/components/ui';
import type { FormState } from './actions';

const empty: FormState = { errors: {} };

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="hint" role="alert" style={{ color: 'var(--design-danger)' }}>
      {message}
    </span>
  ) : null;
}

export type PropertyOption = { id: string; name: string; units: { id: string; number: string }[] };

export function AddTenantForm({
  properties,
  action,
}: {
  properties: PropertyOption[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, empty);
  const v = state.values ?? {};
  const [propertyId, setPropertyId] = useState(v.propertyId ?? '');
  const units = properties.find((p) => p.id === propertyId)?.units ?? [];

  return (
    <Card id="add-tenant">
      <CardHeader title="Add tenant" action={<Badge tone="info">Quick form</Badge>} />
      <form className="form" action={formAction} noValidate>
        {state.message && !Object.keys(state.errors).length && (
          <div className="alert warning" role="alert">
            {state.message}
          </div>
        )}
        <FormRow columns={3}>
          <Field label="Full name">
            <Input name="name" placeholder="Jamie Doe" defaultValue={v.name} required />
            <FieldError message={state.errors.name} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" placeholder="jamie@email.com" defaultValue={v.email} />
            <FieldError message={state.errors.email} />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" placeholder="(555) 010-2030" defaultValue={v.phone} />
            <FieldError message={state.errors.phone} />
          </Field>
        </FormRow>
        <FormRow columns={3}>
          <Field label="Property">
            <Select
              name="propertyId"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
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
            <Select name="unitId" defaultValue={v.unitId ?? ''} key={propertyId}>
              <option value="">
                {propertyId ? 'Select a vacant unit' : 'Choose a property first'}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.number}
                </option>
              ))}
            </Select>
            <FieldError message={state.errors.unitId} />
          </Field>
          <Field label="Move-in date">
            <Input name="moveInDate" type="date" defaultValue={v.moveInDate} />
            <FieldError message={state.errors.moveInDate} />
          </Field>
        </FormRow>
        <div className="row">
          <span className="muted" style={{ flex: 1 }}>
            Choosing a unit drafts a lease you can move the tenant into.
          </span>
          <Button type="reset" variant="secondary" onClick={() => setPropertyId('')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save tenant'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function EditTenantForm({
  tenant,
  action,
  cancelHref,
}: {
  tenant: { name: string; email: string | null; phone: string | null };
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, empty);
  const v = state.values ?? {};
  return (
    <Card>
      <CardHeader title="Edit profile" />
      <form className="form" action={formAction} noValidate>
        {state.message && !Object.keys(state.errors).length && (
          <div className="alert warning" role="alert">
            {state.message}
          </div>
        )}
        <FormRow columns={3}>
          <Field label="Full name">
            <Input name="name" defaultValue={v.name ?? tenant.name} required />
            <FieldError message={state.errors.name} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={v.email ?? tenant.email ?? ''} />
            <FieldError message={state.errors.email} />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={v.phone ?? tenant.phone ?? ''} />
            <FieldError message={state.errors.phone} />
          </Field>
        </FormRow>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
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
