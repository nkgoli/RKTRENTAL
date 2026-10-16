'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FileUploader } from '@/components/upload';

type TargetKind = 'lease' | 'property' | 'unit';
type TargetOption = { id: string; label: string };

const kinds = [
  ['LEASE', 'Lease'],
  ['NOTICE', 'Notice'],
  ['INSPECTION', 'Inspection'],
  ['ID', 'ID'],
  ['PHOTO', 'Photo'],
  ['OTHER', 'Other'],
] as const;

export function UploadDocumentForm({
  leases,
  properties,
  units,
}: {
  leases: TargetOption[];
  properties: TargetOption[];
  units: TargetOption[];
}) {
  const router = useRouter();
  const options: Record<TargetKind, TargetOption[]> = useMemo(
    () => ({ lease: leases, property: properties, unit: units }),
    [leases, properties, units],
  );
  const firstTarget: TargetKind = leases.length ? 'lease' : properties.length ? 'property' : 'unit';
  const [targetType, setTargetType] = useState<TargetKind>(firstTarget);
  const [targetId, setTargetId] = useState(options[firstTarget][0]?.id ?? '');
  const [kind, setKind] = useState<(typeof kinds)[number][0]>('LEASE');

  const availableTargets = options[targetType];

  function changeTargetType(value: TargetKind) {
    setTargetType(value);
    setTargetId(options[value][0]?.id ?? '');
  }

  return (
    <div className="stack" role="group" aria-label="Upload a document">
      <div className="grid-3">
        <label className="field">
          <span>Attach to</span>
          <select
            aria-label="Attach to"
            value={targetType}
            onChange={(event) => changeTargetType(event.target.value as TargetKind)}
          >
            <option value="lease">Lease</option>
            <option value="property">Property</option>
            <option value="unit">Unit</option>
          </select>
        </label>
        <label className="field">
          <span>Destination</span>
          <select
            aria-label="Upload destination"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            disabled={!availableTargets.length}
            required
          >
            {availableTargets.length ? (
              availableTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))
            ) : (
              <option value="">No available destinations</option>
            )}
          </select>
        </label>
        <label className="field">
          <span>File type</span>
          <select
            aria-label="File type"
            value={kind}
            onChange={(event) => setKind(event.target.value as (typeof kinds)[number][0])}
          >
            {kinds.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {availableTargets.length ? (
        <FileUploader
          key={`${targetType}:${targetId}`}
          kind={kind === 'PHOTO' ? 'photo' : 'document'}
          target={{ kind: targetType, id: targetId }}
          documentKind={kind}
          label="Upload files"
          onUploaded={() => router.refresh()}
        />
      ) : (
        <p className="muted">Add a lease, property or unit before uploading files.</p>
      )}
    </div>
  );
}
