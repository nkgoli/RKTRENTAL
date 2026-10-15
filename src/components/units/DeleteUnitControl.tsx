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
      style={{ marginTop: 14 }}
      onSubmit={(event) => {
        if (!window.confirm('Delete this empty unit? This cannot be undone.')) event.preventDefault();
      }}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="unitId" value={unitId} />
      <button className="btn btn-ghost btn-sm" type="submit" disabled={disabled}>
        Delete
      </button>
      {disabled && (
        <small className="muted" style={{ marginLeft: 10 }}>
          {implicit ? 'The single-family home unit cannot be deleted.' : 'A unit with linked records cannot be deleted.'}
        </small>
      )}
    </form>
  );
}
