'use client';

import { deleteEmptyUnitAction } from '@/app/(manager)/properties/actions';

export function DeleteUnitControl({
  propertyId,
  unitId,
  disabled,
  implicit,
}: {
  propertyId: string;
  unitId: string;
  disabled: boolean;
  implicit: boolean;
}) {
  return (
    <form
      action={deleteEmptyUnitAction}
      style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--rr-border)', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}
      onSubmit={(event) => {
        if (!window.confirm('Delete this empty unit? This cannot be undone.')) event.preventDefault();
      }}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="unitId" value={unitId} />
      <button className="btn btn-danger btn-sm" type="submit" disabled={disabled} style={{ flexShrink: 0 }}>
        Delete unit
      </button>
      {disabled && (
        <small className="muted" style={{ paddingTop: 4, maxWidth: 270 }}>
          {implicit ? 'The single-family home unit cannot be deleted.' : 'A unit with linked records cannot be deleted.'}
        </small>
      )}
    </form>
  );
}
