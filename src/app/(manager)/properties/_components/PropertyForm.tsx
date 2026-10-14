'use client';

import { useActionState, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  FormRow,
  Input,
  Select,
} from '@/components/ui';
import {
  createPropertyAction,
  setPropertyArchivedAction,
  updatePropertyAction,
  type FormState,
} from '../actions';
import { FieldError } from './FieldError';

export type OwnerOption = { id: string; name: string };
export type PropertyFormValues = {
  name: string;
  type: 'SINGLE_UNIT' | 'MULTI_UNIT';
  street: string;
  city: string;
  state: string;
  postalCode: string;
  yearBuilt: number | null;
  ownerId: string | null;
};

const empty: FormState = {};

export function AddPropertyForm({ owners }: { owners: OwnerOption[] }) {
  const [state, action, pending] = useActionState(createPropertyAction, empty);
  const [type, setType] = useState('MULTI_UNIT');
  const e = state.errors ?? {};

  return (
    <Card id="add-property" style={{ gridColumn: 'span 2' }}>
      <CardHeader title="Add a property" action={<Badge tone="info">New</Badge>} />
      <form className="form" action={action} noValidate>
        {state.message && !state.ok && <Alert tone="warning">{state.message}</Alert>}
        <FormRow>
          <Field label="Property name">
            <Input name="name" placeholder="e.g. Oak Terrace" required aria-invalid={!!e.name} />
            <FieldError message={e.name} />
          </Field>
          <Field label="Type">
            <Select name="type" value={type} onChange={(ev) => setType(ev.target.value)}>
              <option value="MULTI_UNIT">Multi-unit building</option>
              <option value="SINGLE_UNIT">Single-unit home</option>
            </Select>
            <FieldError message={e.type} />
          </Field>
        </FormRow>
        <Field label="Street address">
          <Input name="street" placeholder="214 Maple Ave" required aria-invalid={!!e.street} />
          <FieldError message={e.street} />
        </Field>
        <FormRow columns={3}>
          <Field label="City">
            <Input name="city" placeholder="Austin" required aria-invalid={!!e.city} />
            <FieldError message={e.city} />
          </Field>
          <Field label="State">
            <Input name="state" placeholder="TX" maxLength={2} required aria-invalid={!!e.state} />
            <FieldError message={e.state} />
          </Field>
          <Field label="ZIP">
            <Input name="postalCode" placeholder="78704" required aria-invalid={!!e.postalCode} />
            <FieldError message={e.postalCode} />
          </Field>
        </FormRow>
        <FormRow columns={3}>
          {type === 'MULTI_UNIT' ? (
            <Field label="Number of units" hint="You can add or rename units later.">
              <Input
                name="unitCount"
                type="number"
                min={0}
                defaultValue={0}
                aria-invalid={!!e.unitCount}
              />
              <FieldError message={e.unitCount} />
            </Field>
          ) : (
            <Field label="Units" hint="A single-unit home has one unit.">
              <Input value="1" disabled readOnly />
            </Field>
          )}
          <Field label="Year built">
            <Input
              name="yearBuilt"
              placeholder="2004"
              inputMode="numeric"
              aria-invalid={!!e.yearBuilt}
            />
            <FieldError message={e.yearBuilt} />
          </Field>
          <Field label="Owner">
            <Select name="ownerId" defaultValue="" style={{ width: '100%' }}>
              <option value="">No owner</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <FieldError message={e.ownerId} />
          </Field>
        </FormRow>
        <p className="muted" style={{ fontSize: 13 }}>
          Add cover photos from the property page after saving.
        </p>
        <div className="row">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save property'}
          </Button>
          <Button href="/properties" variant="ghost">
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function EditPropertyForm({
  propertyId,
  initial,
  owners,
  archived,
}: {
  propertyId: string;
  initial: PropertyFormValues;
  owners: OwnerOption[];
  archived: boolean;
}) {
  const [state, action, pending] = useActionState(updatePropertyAction, empty);
  const e = state.errors ?? {};

  return (
    <Card id="edit-property">
      <CardHeader
        title="Edit property"
        action={<span className="muted">Changes apply to all units</span>}
      />
      <form className="form" action={action} noValidate>
        <input type="hidden" name="propertyId" value={propertyId} />
        {state.message && <Alert tone={state.ok ? 'success' : 'warning'}>{state.message}</Alert>}
        <FormRow columns={3}>
          <Field label="Name">
            <Input name="name" defaultValue={initial.name} required aria-invalid={!!e.name} />
            <FieldError message={e.name} />
          </Field>
          <Field label="Street address">
            <Input name="street" defaultValue={initial.street} required aria-invalid={!!e.street} />
            <FieldError message={e.street} />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue={initial.type}>
              <option value="MULTI_UNIT">Multi-unit building</option>
              <option value="SINGLE_UNIT">Single-unit home</option>
            </Select>
            <FieldError message={e.type} />
          </Field>
        </FormRow>
        <FormRow columns={3}>
          <Field label="City">
            <Input name="city" defaultValue={initial.city} required aria-invalid={!!e.city} />
            <FieldError message={e.city} />
          </Field>
          <Field label="State">
            <Input
              name="state"
              defaultValue={initial.state}
              maxLength={2}
              required
              aria-invalid={!!e.state}
            />
            <FieldError message={e.state} />
          </Field>
          <Field label="ZIP">
            <Input
              name="postalCode"
              defaultValue={initial.postalCode}
              required
              aria-invalid={!!e.postalCode}
            />
            <FieldError message={e.postalCode} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Year built">
            <Input
              name="yearBuilt"
              defaultValue={initial.yearBuilt ?? ''}
              inputMode="numeric"
              aria-invalid={!!e.yearBuilt}
            />
            <FieldError message={e.yearBuilt} />
          </Field>
          <Field label="Owner">
            <Select name="ownerId" defaultValue={initial.ownerId ?? ''}>
              <option value="">No owner</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <FieldError message={e.ownerId} />
          </Field>
        </FormRow>
        <div className="row">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
      <ArchiveButton propertyId={propertyId} archived={archived} />
    </Card>
  );
}

function ArchiveButton({ propertyId, archived }: { propertyId: string; archived: boolean }) {
  const [state, action, pending] = useActionState(setPropertyArchivedAction, empty);
  return (
    <form action={action} className="row" style={{ marginTop: 12 }}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="archived" value={String(!archived)} />
      <Button type="submit" variant={archived ? 'secondary' : 'danger'} disabled={pending}>
        {archived ? 'Restore property' : 'Archive property'}
      </Button>
      {state.message && !state.ok && <FieldError message={state.message} />}
    </form>
  );
}
