'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { Action, Alert, Badge, Button, Card, CardHeader, Input, Select } from '@/components/ui';
import { updateUnitAction, type FormState } from '@/app/(manager)/properties/actions';
import { FieldError } from '@/app/(manager)/properties/_components/FieldError';
import { formatMoney } from '@/lib/properties/format';
import styles from './WorkspaceOverview.module.css';

const empty: FormState = {};

function EditRow({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt>
        <label htmlFor={`fact-${name}`}>{label}</label>
      </dt>
      <dd>
        {children}
        <FieldError message={error} />
      </dd>
    </>
  );
}

function EditActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className={styles.editActions}>
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
    </div>
  );
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

function UnitFactsForm({
  propertyId,
  unitId,
  implicit,
  hasActiveLease,
  initial,
  onDone,
}: {
  propertyId: string;
  unitId: string;
  implicit: boolean;
  hasActiveLease: boolean;
  initial: UnitFactsValues;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const next = await updateUnitAction(prev, formData);
    if (next.ok) onDone();
    return next;
  }, empty);
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="unitId" value={unitId} />
      {state.message && !state.ok && <Alert tone="warning">{state.message}</Alert>}
      <dl className={styles.facts}>
        <EditRow label="Unit number" name="number" error={e.number}>
          <Input
            id="fact-number"
            name="number"
            defaultValue={initial.number}
            readOnly={implicit}
            required
            aria-invalid={!!e.number}
          />
        </EditRow>
        <EditRow label="Status" name="status" error={e.status}>
          <Select
            id="fact-status"
            name="status"
            defaultValue={hasActiveLease ? 'OCCUPIED' : initial.status}
            disabled={hasActiveLease}
          >
            {hasActiveLease && <option value="OCCUPIED">Occupied</option>}
            <option value="VACANT">Vacant</option>
            <option value="TURNOVER">Turnover</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          {hasActiveLease && <span className="hint">Occupied while a lease is active.</span>}
        </EditRow>
        <EditRow label="Bedrooms" name="bedrooms" error={e.bedrooms}>
          <Input
            id="fact-bedrooms"
            name="bedrooms"
            type="number"
            min={0}
            defaultValue={initial.bedrooms ?? ''}
            aria-invalid={!!e.bedrooms}
          />
        </EditRow>
        <EditRow label="Bathrooms" name="bathrooms" error={e.bathrooms}>
          <Input
            id="fact-bathrooms"
            name="bathrooms"
            type="number"
            min={0}
            step={0.5}
            defaultValue={initial.bathrooms ?? ''}
            aria-invalid={!!e.bathrooms}
          />
        </EditRow>
        <EditRow label="Size (sqft)" name="squareFeet" error={e.squareFeet}>
          <Input
            id="fact-squareFeet"
            name="squareFeet"
            type="number"
            min={1}
            defaultValue={initial.squareFeet ?? ''}
            aria-invalid={!!e.squareFeet}
          />
        </EditRow>
        <EditRow label="Floor" name="floor" error={e.floor}>
          <Input
            id="fact-floor"
            name="floor"
            type="number"
            min={0}
            defaultValue={initial.floor ?? ''}
            aria-invalid={!!e.floor}
          />
        </EditRow>
        <EditRow label="Listed rent" name="listedRent" error={e.listedRent}>
          <Input
            id="fact-listedRent"
            name="listedRent"
            inputMode="decimal"
            defaultValue={initial.listedRent ?? ''}
            aria-invalid={!!e.listedRent}
          />
        </EditRow>
        <EditRow label="Market rent" name="marketRent" error={e.marketRent}>
          <Input
            id="fact-marketRent"
            name="marketRent"
            inputMode="decimal"
            defaultValue={initial.marketRent ?? ''}
            aria-invalid={!!e.marketRent}
          />
        </EditRow>
        <EditRow label="Amenities" name="amenities" error={e.amenities}>
          <Input
            id="fact-amenities"
            name="amenities"
            defaultValue={initial.amenities.join(', ')}
            aria-invalid={!!e.amenities}
          />
          <span className="hint">Comma-separated, e.g. In-unit laundry, Balcony</span>
        </EditRow>
      </dl>
      <EditActions pending={pending} onCancel={onDone} />
    </form>
  );
}

/** Unit facts that switch to inline fields in place; status is shown only in the header badge. */
export function UnitFactsCard({
  propertyId,
  unitId,
  implicit,
  hasActiveLease,
  initial,
  footer,
}: {
  propertyId: string;
  unitId: string;
  implicit: boolean;
  hasActiveLease: boolean;
  initial: UnitFactsValues;
  footer?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Card id="unit-facts">
      <CardHeader
        title="Unit facts"
        action={
          editing ? undefined : (
            <Action
              icon="edit"
              text="Edit"
              label="Edit unit"
              tone="secondary"
              onClick={() => setEditing(true)}
            />
          )
        }
      />
      {editing ? (
        <UnitFactsForm
          propertyId={propertyId}
          unitId={unitId}
          implicit={implicit}
          hasActiveLease={hasActiveLease}
          initial={initial}
          onDone={() => setEditing(false)}
        />
      ) : (
        <dl className={styles.facts}>
          <dt>Bedrooms</dt>
          <dd>{initial.bedrooms ?? '—'}</dd>
          <dt>Bathrooms</dt>
          <dd>{initial.bathrooms ?? '—'}</dd>
          <dt>Size</dt>
          <dd>{initial.squareFeet ? `${initial.squareFeet.toLocaleString('en-US')} sqft` : '—'}</dd>
          <dt>Floor</dt>
          <dd>{initial.floor ?? '—'}</dd>
          <dt>Listed rent</dt>
          <dd>{formatMoney(initial.listedRent)}</dd>
          <dt>Market rent</dt>
          <dd>{formatMoney(initial.marketRent)}</dd>
          <dt>Amenities</dt>
          <dd>
            {initial.amenities.length
              ? initial.amenities.map((amenity) => <Badge key={amenity}>{amenity}</Badge>)
              : '—'}
          </dd>
        </dl>
      )}
      {!editing && footer}
    </Card>
  );
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

/**
 * Property details are read-only; the workspace header owns the address, type and property-edit
 * entry, so they are not repeated here.
 */
export function PropertyFactsCard({
  initial,
  unitSummary,
  ownerName,
  rentRoll,
  links,
  footer,
}: {
  propertyId: string;
  initial: PropertyFactsValues;
  owners: { id: string; name: string }[];
  /** @deprecated Shown in the workspace header. */ address?: string;
  /** @deprecated Shown in the workspace header. */ typeLabel?: string;
  /** Optional; the overview shows units in its header eyebrow and units card instead. */
  unitSummary?: string;
  ownerName: string;
  /** Formatted monthly rent roll, e.g. "$21,400 / month". */
  rentRoll?: string;
  /** Quiet "→" links under the list (Returns & ROI, pricing). */
  links?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card id="property-facts" className={styles.detailsPanel}>
      <CardHeader title="Property details" />
      <dl className={styles.detailsList}>
        <div>
          <dt>Year built</dt>
          <dd>{initial.yearBuilt ?? '—'}</dd>
        </div>
        {unitSummary && (
          <div>
            <dt>Units</dt>
            <dd>{unitSummary}</dd>
          </div>
        )}
        <div>
          <dt>Owner</dt>
          <dd>{ownerName}</dd>
        </div>
        {rentRoll && (
          <div>
            <dt>Rent roll</dt>
            <dd>{rentRoll}</dd>
          </div>
        )}
      </dl>
      {links && <div className={styles.detailsLinks}>{links}</div>}
      {footer}
    </Card>
  );
}
