'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { Alert, Badge, Button, Card, CardHeader, Input, Select } from '@/components/ui';
import { updatePropertyAction, updateUnitAction, type FormState } from '@/app/(manager)/properties/actions';
import { FieldError } from '@/app/(manager)/properties/_components/FieldError';
import { formatMoney } from '@/lib/properties/format';
import styles from './WorkspaceOverview.module.css';

const empty: FormState = {};

function EditRow({ label, name, error, children }: { label: string; name: string; error?: string; children: ReactNode }) {
  return <>
    <dt><label htmlFor={`fact-${name}`}>{label}</label></dt>
    <dd>{children}<FieldError message={error} /></dd>
  </>;
}

function EditActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return <div className={styles.editActions}>
    <Button type="submit" variant="primary" size="sm" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
    <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
  </div>;
}

export type UnitFactsValues = {
  number: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  listedRent: number | null;
  marketRent: number | null;
  floor: number | null;
  amenities: string[];
};

function UnitFactsForm({ propertyId, unitId, implicit, hasActiveLease, initial, onDone }: {
  propertyId: string; unitId: string; implicit: boolean; hasActiveLease: boolean; initial: UnitFactsValues; onDone: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const next = await updateUnitAction(prev, formData);
    if (next.ok) onDone();
    return next;
  }, empty);
  const e = state.errors ?? {};
  return <form action={action} noValidate>
    <input type="hidden" name="propertyId" value={propertyId} />
    <input type="hidden" name="unitId" value={unitId} />
    {state.message && !state.ok && <Alert tone="warning">{state.message}</Alert>}
    <dl className={styles.facts}>
      <EditRow label="Unit number" name="number" error={e.number}>
        <Input id="fact-number" name="number" defaultValue={initial.number} readOnly={implicit} required aria-invalid={!!e.number} />
      </EditRow>
      <EditRow label="Status" name="status" error={e.status}>
        <Select id="fact-status" name="status" defaultValue={hasActiveLease ? 'OCCUPIED' : initial.status} disabled={hasActiveLease}>
          {hasActiveLease && <option value="OCCUPIED">Occupied</option>}
          <option value="VACANT">Vacant</option>
          <option value="TURNOVER">Turnover</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        {hasActiveLease && <span className="hint">Occupied while a lease is active.</span>}
      </EditRow>
      <EditRow label="Bedrooms" name="bedrooms" error={e.bedrooms}>
        <Input id="fact-bedrooms" name="bedrooms" type="number" min={0} defaultValue={initial.bedrooms ?? ''} aria-invalid={!!e.bedrooms} />
      </EditRow>
      <EditRow label="Bathrooms" name="bathrooms" error={e.bathrooms}>
        <Input id="fact-bathrooms" name="bathrooms" type="number" min={0} step={0.5} defaultValue={initial.bathrooms ?? ''} aria-invalid={!!e.bathrooms} />
      </EditRow>
      <EditRow label="Size (sqft)" name="squareFeet" error={e.squareFeet}>
        <Input id="fact-squareFeet" name="squareFeet" type="number" min={1} defaultValue={initial.squareFeet ?? ''} aria-invalid={!!e.squareFeet} />
      </EditRow>
      <EditRow label="Floor" name="floor" error={e.floor}>
        <Input id="fact-floor" name="floor" type="number" min={0} defaultValue={initial.floor ?? ''} aria-invalid={!!e.floor} />
      </EditRow>
      <EditRow label="Listed rent" name="listedRent" error={e.listedRent}>
        <Input id="fact-listedRent" name="listedRent" inputMode="decimal" defaultValue={initial.listedRent ?? ''} aria-invalid={!!e.listedRent} />
      </EditRow>
      <EditRow label="Market rent" name="marketRent" error={e.marketRent}>
        <Input id="fact-marketRent" name="marketRent" inputMode="decimal" defaultValue={initial.marketRent ?? ''} aria-invalid={!!e.marketRent} />
      </EditRow>
      <EditRow label="Amenities" name="amenities" error={e.amenities}>
        <Input id="fact-amenities" name="amenities" defaultValue={initial.amenities.join(', ')} aria-invalid={!!e.amenities} />
        <span className="hint">Comma-separated, e.g. In-unit laundry, Balcony</span>
      </EditRow>
    </dl>
    <EditActions pending={pending} onCancel={onDone} />
  </form>;
}

/** Unit facts that switch to inline fields in place; status is shown only in the header badge. */
export function UnitFactsCard({ propertyId, unitId, implicit, hasActiveLease, initial, footer }: {
  propertyId: string; unitId: string; implicit: boolean; hasActiveLease: boolean; initial: UnitFactsValues; footer?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return <Card id="unit-facts">
    <CardHeader title="Unit facts" action={editing ? undefined : <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>} />
    {editing
      ? <UnitFactsForm propertyId={propertyId} unitId={unitId} implicit={implicit} hasActiveLease={hasActiveLease} initial={initial} onDone={() => setEditing(false)} />
      : <dl className={styles.facts}>
        <dt>Bedrooms</dt><dd>{initial.bedrooms ?? '—'}</dd>
        <dt>Bathrooms</dt><dd>{initial.bathrooms ?? '—'}</dd>
        <dt>Size</dt><dd>{initial.squareFeet ? `${initial.squareFeet.toLocaleString('en-US')} sqft` : '—'}</dd>
        <dt>Floor</dt><dd>{initial.floor ?? '—'}</dd>
        <dt>Listed rent</dt><dd>{formatMoney(initial.listedRent)}</dd>
        <dt>Market rent</dt><dd>{formatMoney(initial.marketRent)}</dd>
        <dt>Amenities</dt><dd>{initial.amenities.length ? initial.amenities.map((amenity) => <Badge key={amenity}>{amenity}</Badge>) : '—'}</dd>
      </dl>}
    {!editing && footer}
  </Card>;
}

export type PropertyFactsValues = {
  name: string;
  type: 'SINGLE_UNIT' | 'MULTI_UNIT';
  street: string;
  city: string;
  state: string;
  postalCode: string;
  yearBuilt: number | null;
  ownerId: string | null;
};

function PropertyFactsForm({ propertyId, initial, owners, onDone }: {
  propertyId: string; initial: PropertyFactsValues; owners: { id: string; name: string }[]; onDone: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const next = await updatePropertyAction(prev, formData);
    if (next.ok) onDone();
    return next;
  }, empty);
  const e = state.errors ?? {};
  return <form action={action} noValidate>
    <input type="hidden" name="propertyId" value={propertyId} />
    {state.message && !state.ok && <Alert tone="warning">{state.message}</Alert>}
    <dl className={styles.facts}>
      <EditRow label="Name" name="name" error={e.name}>
        <Input id="fact-name" name="name" defaultValue={initial.name} required aria-invalid={!!e.name} />
      </EditRow>
      <EditRow label="Street address" name="street" error={e.street}>
        <Input id="fact-street" name="street" defaultValue={initial.street} required aria-invalid={!!e.street} />
      </EditRow>
      <EditRow label="City" name="city" error={e.city}>
        <Input id="fact-city" name="city" defaultValue={initial.city} required aria-invalid={!!e.city} />
      </EditRow>
      <EditRow label="State" name="state" error={e.state}>
        <Input id="fact-state" name="state" defaultValue={initial.state} maxLength={2} required aria-invalid={!!e.state} />
      </EditRow>
      <EditRow label="ZIP" name="postalCode" error={e.postalCode}>
        <Input id="fact-postalCode" name="postalCode" defaultValue={initial.postalCode} required aria-invalid={!!e.postalCode} />
      </EditRow>
      <EditRow label="Type" name="type" error={e.type}>
        <Select id="fact-type" name="type" defaultValue={initial.type}>
          <option value="MULTI_UNIT">Multi-unit building</option>
          <option value="SINGLE_UNIT">Single-unit home</option>
        </Select>
      </EditRow>
      <EditRow label="Year built" name="yearBuilt" error={e.yearBuilt}>
        <Input id="fact-yearBuilt" name="yearBuilt" inputMode="numeric" defaultValue={initial.yearBuilt ?? ''} aria-invalid={!!e.yearBuilt} />
      </EditRow>
      <EditRow label="Owner" name="ownerId" error={e.ownerId}>
        <Select id="fact-ownerId" name="ownerId" defaultValue={initial.ownerId ?? ''}>
          <option value="">No owner</option>
          {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
        </Select>
      </EditRow>
    </dl>
    <EditActions pending={pending} onCancel={onDone} />
  </form>;
}

/** Property details that switch to inline fields in place. */
export function PropertyFactsCard({ propertyId, initial, owners, address, typeLabel, unitSummary, ownerName, footer }: {
  propertyId: string; initial: PropertyFactsValues; owners: { id: string; name: string }[];
  address: string; typeLabel: string; unitSummary: string; ownerName: string; footer?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return <Card id="property-facts">
    <CardHeader title="Property details" action={editing ? undefined : <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>} />
    {editing
      ? <PropertyFactsForm propertyId={propertyId} initial={initial} owners={owners} onDone={() => setEditing(false)} />
      : <dl className={styles.facts}>
        <dt>Address</dt><dd>{address}</dd>
        <dt>Type</dt><dd>{typeLabel}</dd>
        <dt>Year built</dt><dd>{initial.yearBuilt ?? '—'}</dd>
        <dt>Units</dt><dd>{unitSummary}</dd>
        <dt>Owner</dt><dd>{ownerName}</dd>
      </dl>}
    {!editing && footer}
  </Card>;
}
