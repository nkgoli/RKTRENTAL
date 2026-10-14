'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Alert, Button, Card, CardHeader, Field, FormRow, Input, Select } from '@/components/ui';
import { createUnitAction, updateUnitAction, type FormState } from '../actions';
import { FieldError } from './FieldError';

export type UnitFormValues = {
  number: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  listedRent: number | null;
  marketRent: number | null;
  floor: number | null;
  amenities: string[];
  status: string;
};

const empty: FormState = {};

export function AddUnitForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(createUnitAction, empty);
  const ref = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card id="add-unit">
      <CardHeader title="Add unit" />
      <form className="form" action={action} ref={ref} noValidate>
        <input type="hidden" name="propertyId" value={propertyId} />

        {state.message && <Alert tone={state.ok ? 'success' : 'warning'}>{state.message}</Alert>}
        <FormRow>
          <Field label="Unit number">
            <Input
              name="number"
              placeholder="6A"
              required
              style={{ minWidth: 0 }}
              aria-invalid={!!e.number}
            />
            <FieldError message={e.number} />
          </Field>
          <Field label="Monthly rent">
            <Input
              name="listedRent"
              placeholder="$1,750"
              inputMode="decimal"
              style={{ minWidth: 0, width: '100%' }}
              aria-invalid={!!e.listedRent}
            />
            <FieldError message={e.listedRent} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Bedrooms">
            <Input
              name="bedrooms"
              type="number"
              min={0}
              defaultValue={2}
              style={{ minWidth: 0, width: '100%' }}
              aria-invalid={!!e.bedrooms}
            />
            <FieldError message={e.bedrooms} />
          </Field>
          <Field label="Bathrooms">
            <Input
              name="bathrooms"
              type="number"
              min={0}
              step={0.5}
              defaultValue={1}
              style={{ minWidth: 0, width: '100%' }}
              aria-invalid={!!e.bathrooms}
            />
            <FieldError message={e.bathrooms} />
          </Field>
        </FormRow>
        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? 'Saving…' : 'Save unit'}
        </Button>
      </form>
    </Card>
  );
}

export function EditUnitForm({
  propertyId,
  unitId,
  implicit,
  hasActiveLease,
  initial,
}: {
  propertyId: string;
  unitId: string;
  implicit: boolean;
  hasActiveLease: boolean;
  initial: UnitFormValues;
}) {
  const [state, action, pending] = useActionState(updateUnitAction, empty);
  const e = state.errors ?? {};

  return (
    <form className="form" action={action} noValidate id="edit-unit-form">
      <input type="hidden" name="propertyId" value={propertyId} />
      {unitId && <input type="hidden" name="unitId" value={unitId} />}
      {state.message && <Alert tone={state.ok ? 'success' : 'warning'}>{state.message}</Alert>}
      <FormRow>
        <Field label="Unit number">
          <Input
            name="number"
            defaultValue={initial.number}
            readOnly={implicit}
            required
            aria-invalid={!!e.number}
          />
          <FieldError message={e.number} />
        </Field>
        <Field
          label="Status"
          hint={hasActiveLease ? 'Occupied while a lease is active.' : undefined}
        >
          <Select
            name="status"
            defaultValue={hasActiveLease ? 'OCCUPIED' : initial.status}
            disabled={hasActiveLease}
          >
            {hasActiveLease && <option value="OCCUPIED">Occupied</option>}
            <option value="VACANT">Vacant</option>
            <option value="TURNOVER">Turnover</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <FieldError message={e.status} />
        </Field>
      </FormRow>
      <FormRow columns={3}>
        <Field label="Bedrooms">
          <Input
            name="bedrooms"
            type="number"
            min={0}
            defaultValue={initial.bedrooms ?? ''}
            aria-invalid={!!e.bedrooms}
          />
          <FieldError message={e.bedrooms} />
        </Field>
        <Field label="Bathrooms">
          <Input
            name="bathrooms"
            type="number"
            min={0}
            step={0.5}
            defaultValue={initial.bathrooms ?? ''}
            aria-invalid={!!e.bathrooms}
          />
          <FieldError message={e.bathrooms} />
        </Field>
        <Field label="Size (sqft)">
          <Input
            name="squareFeet"
            type="number"
            min={1}
            defaultValue={initial.squareFeet ?? ''}
            aria-invalid={!!e.squareFeet}
          />
          <FieldError message={e.squareFeet} />
        </Field>
      </FormRow>
      <FormRow columns={3}>
        <Field label="Listed rent (per month)">
          <Input
            name="listedRent"
            inputMode="decimal"
            defaultValue={initial.listedRent ?? ''}
            aria-invalid={!!e.listedRent}
          />
          <FieldError message={e.listedRent} />
        </Field>
        <Field label="Market rent (per month)">
          <Input
            name="marketRent"
            inputMode="decimal"
            defaultValue={initial.marketRent ?? ''}
            aria-invalid={!!e.marketRent}
          />
          <FieldError message={e.marketRent} />
        </Field>
        <Field label="Floor">
          <Input
            name="floor"
            type="number"
            min={0}
            defaultValue={initial.floor ?? ''}
            aria-invalid={!!e.floor}
          />
          <FieldError message={e.floor} />
        </Field>
      </FormRow>
      <Field label="Amenities" hint="Comma-separated, e.g. In-unit laundry, Balcony">
        <Input
          name="amenities"
          defaultValue={initial.amenities.join(', ')}
          aria-invalid={!!e.amenities}
        />
        <FieldError message={e.amenities} />
      </Field>
      <div className="row">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save unit'}
        </Button>
      </div>
    </form>
  );
}
