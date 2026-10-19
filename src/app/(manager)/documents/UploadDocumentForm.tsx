'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FileUploader } from '@/components/upload';
import styles from './documents.module.css';

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
  propertyId,
  unitId,
}: {
  leases: TargetOption[];
  properties: TargetOption[];
  units: TargetOption[];
  propertyId?: string;
  unitId?: string;
}) {
  const router = useRouter();
  const options: Record<TargetKind, TargetOption[]> = useMemo(
    () => ({ lease: leases, property: properties, unit: units }),
    [leases, properties, units],
  );
  const firstTarget: TargetKind = unitId
    ? 'unit'
    : propertyId
      ? 'property'
      : leases.length
        ? 'lease'
        : properties.length
          ? 'property'
          : 'unit';
  const [targetType, setTargetType] = useState<TargetKind>(firstTarget);
  const initialId = unitId ?? propertyId ?? '';
  const [targetId, setTargetId] = useState(
    options[firstTarget].some((target) => target.id === initialId) ? initialId : '',
  );
  const [kind, setKind] = useState<(typeof kinds)[number][0]>('LEASE');

  const availableTargets = options[targetType];

  function changeTargetType(value: TargetKind) {
    setTargetType(value);
    setTargetId('');
  }

  return (
    <div className="stack" role="group" aria-label="Upload a document">
      <div className={styles.uploadFields}>
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
        <label className={`field ${styles.destination}`}>
          <span>Destination</span>
          <select
            aria-label="Upload destination"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            disabled={!availableTargets.length}
            required
          >
            <option value="">Choose a destination</option>
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
      {availableTargets.length && targetId ? (
        <FileUploader
          key={`${targetType}:${targetId}:${kind}`}
          kind={kind === 'PHOTO' ? 'photo' : 'document'}
          target={{ kind: targetType, id: targetId }}
          documentKind={kind}
          label="Upload files"
          onUploaded={() => router.refresh()}
        />
      ) : (
        <p className="muted">
          {availableTargets.length
            ? 'Choose where these files belong. Files upload as soon as you select them.'
            : 'No destinations of this type. Choose another type, or add a lease, property or unit first.'}
        </p>
      )}
      {targetId && (
        <p className={styles.uploadHint}>
          Files upload immediately to{' '}
          {availableTargets.find((target) => target.id === targetId)?.label}. To rename, share or
          delete a file, open its lease or property.
        </p>
      )}
    </div>
  );
}
