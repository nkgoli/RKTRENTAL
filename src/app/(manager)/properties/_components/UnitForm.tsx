'use client';

import { useActionState, useId, useEffect, useRef } from 'react';
import { Alert, Button, Card, CardHeader, Field, FormRow, Input } from '@/components/ui';
import { createUnitAction, type FormState } from '../actions';
import { FieldError } from './FieldError';

const empty: FormState = {};

export function AddUnitForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(createUnitAction, empty);
  const ref = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};
  const formId = useId();

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
              aria-invalid={!!e.number} aria-describedby={e.number ? `${formId}-number-error` : undefined}
            />
            <FieldError id={`${formId}-number-error`} message={e.number} />
          </Field>
          <Field label="Monthly rent">
            <Input
              name="listedRent"
              placeholder="$1,750"
              inputMode="decimal"
              style={{ minWidth: 0, width: '100%' }}
              aria-invalid={!!e.listedRent} aria-describedby={e.listedRent ? `${formId}-listedRent-error` : undefined}
            />
            <FieldError id={`${formId}-listedRent-error`} message={e.listedRent} />
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
              aria-invalid={!!e.bedrooms} aria-describedby={e.bedrooms ? `${formId}-bedrooms-error` : undefined}
            />
            <FieldError id={`${formId}-bedrooms-error`} message={e.bedrooms} />
          </Field>
          <Field label="Bathrooms">
            <Input
              name="bathrooms"
              type="number"
              min={0}
              step={0.5}
              defaultValue={1}
              style={{ minWidth: 0, width: '100%' }}
              aria-invalid={!!e.bathrooms} aria-describedby={e.bathrooms ? `${formId}-bathrooms-error` : undefined}
            />
            <FieldError id={`${formId}-bathrooms-error`} message={e.bathrooms} />
          </Field>
        </FormRow>
        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? 'Saving…' : 'Save unit'}
        </Button>
      </form>
    </Card>
  );
}
