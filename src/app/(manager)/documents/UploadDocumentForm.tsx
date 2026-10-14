'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
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
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const availableTargets = options[targetType];

  function changeTargetType(value: TargetKind) {
    setTargetType(value);
    setTargetId(options[value][0]?.id ?? '');
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file');
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
    if (!file || !targetId) {
      setMessage('Choose a file and an upload destination.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setMessage('Files must be 25 MB or smaller.');
      return;
    }

    const body = new FormData();
    body.set('file', file);
    body.set('targetType', targetType);
    body.set('targetId', targetId);
    body.set('kind', kind);

    setIsUploading(true);
    try {
      const response = await fetch('/api/files', { method: 'POST', body });
      const result = (await response.json()) as { file?: { name: string }; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The file could not be uploaded.');
      setMessage(`${result.file?.name ?? file.name} uploaded.`);
      if (fileInput instanceof HTMLInputElement) fileInput.value = '';
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The file could not be uploaded.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="stack" aria-label="Upload a document">
      <label
        className={`upload ${styles.uploadDropZone}`}
        style={{ position: 'relative', cursor: 'pointer' }}
      >
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx"
          aria-label="Choose a file to upload"
          required
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0 }}
        />
        <span>
          <strong>Drag and drop files here</strong> or browse
        </span>
        <span className="muted" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
          PDF, JPG, PNG, HEIC or Word · up to 25 MB each
        </span>
      </label>
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
      <div className="row between" style={{ flexWrap: 'wrap' }}>
        <span className="muted" role="status" aria-live="polite">
          {message}
        </span>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={isUploading || !availableTargets.length}
        >
          {isUploading ? 'Uploading…' : 'Upload file'}
        </button>
      </div>
    </form>
  );
}
