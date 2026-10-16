'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FileUploader, type FileUploaderItem } from '@/components/upload';

type Target = { kind: 'property' | 'unit'; id: string };
type StoredPhoto = { id: string; name: string; sizeBytes?: number; isCover?: boolean };

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'The change could not be saved.');
  }
}

const idOf = (item: FileUploaderItem) => String(item.document?.id ?? '');

/** Property or unit photos: upload, counter and limit, with reorder and cover saved to the server. */
export function PhotoManager({
  target,
  photos,
  max,
}: {
  target: Target;
  photos: StoredPhoto[];
  max: number | null;
}) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function persist(action: () => Promise<void>) {
    setError('');
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved.');
    }
  }

  return (
    <>
      <FileUploader
        kind="photo"
        label={`${target.kind === 'unit' ? 'Unit' : 'Property'} photos`}
        target={target}
        max={max ?? undefined}
        initialFiles={photos.map((photo) => ({
          ...photo,
          previewUrl: `/api/files/${photo.id}/preview`,
        }))}
        onUploaded={() => router.refresh()}
        onOrderChange={(items) =>
          void persist(() =>
            send('/api/files/reorder', 'POST', {
              targetType: target.kind,
              targetId: target.id,
              orderedIds: items.map(idOf).filter(Boolean),
            }),
          )
        }
        onCoverChange={(item) => {
          if (!item) return;
          void persist(() =>
            send('/api/files/cover', 'POST', {
              targetType: target.kind,
              targetId: target.id,
              documentId: idOf(item),
            }),
          );
        }}
        onRemove={(item) => send(`/api/files/${idOf(item)}`, 'DELETE').then(() => router.refresh())}
      />
      {error && (
        <p role="alert" style={{ color: 'var(--design-danger)' }}>
          {error}
        </p>
      )}
    </>
  );
}

/** Documents for a property or unit; refreshes the page's file list after each upload. */
export function DocumentUploader({ target, label }: { target: Target; label?: string }) {
  const router = useRouter();
  return (
    <FileUploader
      kind="document"
      target={target}
      label={label ?? 'Upload documents'}
      onUploaded={() => router.refresh()}
    />
  );
}

/** One upload area for a property or unit: a small toggle picks whether files are photos or documents. */
export function FilesUploader({
  target,
  photos,
  max,
}: {
  target: Target;
  photos: StoredPhoto[];
  max: number | null;
}) {
  const [mode, setMode] = useState<'photo' | 'document'>('photo');
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div role="group" aria-label="Upload type" className="row" style={{ gap: 6 }}>
        {(['photo', 'document'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${mode === value ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === 'photo' ? 'Photos' : 'Documents'}
          </button>
        ))}
      </div>
      {mode === 'photo' ? (
        <PhotoManager target={target} photos={photos} max={max} />
      ) : (
        <DocumentUploader target={target} label="Upload documents" />
      )}
    </div>
  );
}
