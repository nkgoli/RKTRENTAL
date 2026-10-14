'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

const ACCEPT = {
  PHOTO: 'image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif',
  OTHER: '.pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx',
} as const;

/** Uploads through POST /api/files, then refreshes the server-rendered page. */
export function FileUploader({
  targetType,
  targetId,
  kind,
  label,
  hint,
  compact,
}: {
  targetType: 'property' | 'unit';
  targetId: string;
  kind: 'PHOTO' | 'OTHER';
  label: string;
  hint?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.set('file', file);
      body.set('targetType', targetType);
      body.set('targetId', targetId);
      body.set('kind', kind);
      const res = await fetch('/api/files', { method: 'POST', body });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`${file.name}: ${data.error ?? 'Upload failed'}`);
        break;
      }
    }
    setBusy(false);
    if (input.current) input.current.value = '';
    router.refresh();
  }

  return (
    <div
      className="upload"
      style={{
        display: 'grid',
        placeItems: 'center',
        padding: compact ? 12 : 14,
        position: 'relative',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files);
      }}
    >
      <span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
            color: 'var(--design-primary)',
            fontWeight: 600,
          }}
        >
          {busy ? 'Uploading…' : label}
        </button>
        {hint && (
          <>
            <br />
            {hint}
          </>
        )}
        {error && (
          <>
            <br />
            <span role="alert" style={{ color: 'var(--design-danger)' }}>
              {error}
            </span>
          </>
        )}
      </span>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPT[kind]}
        aria-label={label}
        data-testid={`upload-${targetType}-${kind.toLowerCase()}`}
        onChange={(e) => void upload(e.target.files)}
      />
    </div>
  );
}
