'use client';

import { deleteEmptyUnitAction } from '@/app/(manager)/properties/actions';
import { ConfirmButton } from '@/components/ui';

export function DeleteUnitControl({
  propertyId,
  unitId,
  disabled,
  implicit,
  unitLabel = 'empty unit',
}: {
  propertyId: string;
  unitId: string;
  disabled: boolean;
  implicit: boolean;
  unitLabel?: string;
}) {
  return (
    <div
      style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--rr-border)', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}
    >
      <ConfirmButton label="Delete unit" variant="danger" size="sm" disabled={disabled} title={`Delete ${unitLabel}?`} description="Only an empty unit can be deleted. This cannot be undone." confirmLabel="Delete unit" action={deleteEmptyUnitAction} fields={{ propertyId, unitId }} />
      {disabled && (
        <small className="muted" style={{ paddingTop: 4, maxWidth: 270 }}>
          {implicit ? 'The single-family home unit cannot be deleted.' : 'A unit with linked records cannot be deleted.'}
        </small>
      )}
    </div>
  );
}
