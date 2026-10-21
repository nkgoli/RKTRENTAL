'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileList } from '@/app/(manager)/properties/_components/Media';
import { FileUploader } from '@/components/upload';
import { ConfirmDialog, useToast } from '@/components/ui';
import type { PropertyDetail, UnitDetail } from '@/lib/properties/data';
import { photoLimitForTarget } from '@/lib/storage/photo-limits';
import styles from './WorkspaceMedia.module.css';

type Photo = PropertyDetail['photos'][number] | UnitDetail['photos'][number];
type File = PropertyDetail['files'][number] | UnitDetail['files'][number];
type Target = { kind: 'property' | 'unit'; id: string };

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? 'The change could not be saved.');
  }
}

function Thumbnail({ photo }: { photo: Photo }) {
  const [missing, setMissing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setMissing(true);
  }, [photo.id]);
  return <div className={styles.thumbnail}>
    {missing || photo.mimeType === 'image/heic' ? <span className={styles.placeholder} role="img" aria-label={`Preview unavailable for ${photo.name}`}>Preview unavailable</span> : <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imageRef} src={`/api/files/${photo.id}/preview`} alt={photo.caption ?? photo.name} onError={() => setMissing(true)} />
    </>}
    {photo.isCover && <span className={styles.cover}>Cover</span>}
  </div>;
}

export function WorkspaceMedia({ target, photos, files }: { target: Target; photos: Photo[]; files: File[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<'photo' | 'document'>('photo');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<Photo | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const max = photoLimitForTarget(target);

  async function persist(action: () => Promise<void>, message = 'Photo updated') {
    setError('');
    try {
      await action();
      toast.success(message);
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The change could not be saved.');
      toast.error(cause instanceof Error ? cause.message : 'The change could not be saved.');
      return false;
    }
  }

  function reorder(index: number, offset: -1 | 1) {
    const ids = photos.map((photo) => photo.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    void persist(() => send('/api/files/reorder', 'POST', {
      targetType: target.kind, targetId: target.id, orderedIds: ids,
    }));
  }

  return <div className={styles.media}>
    <div className={styles.gallery} aria-label={`${target.kind === 'property' ? 'Property' : 'Unit'} photos`}>
      {photos.length ? photos.map((photo, index) => <div key={photo.id} className={styles.photo}>
        <Thumbnail photo={photo} />
        <div className={styles.photoFooter}>
          <span className={styles.photoName}>{photo.caption ?? photo.name}</span>
          <div className={styles.actions}>
            {!photo.isCover && <>
              <button type="button" title="Move up" aria-label={`Move ${photo.name} up`} disabled={index === 0 || photos[index - 1]?.isCover} onClick={() => reorder(index, -1)}>↑</button>
              <button type="button" title="Move down" aria-label={`Move ${photo.name} down`} disabled={index === photos.length - 1} onClick={() => reorder(index, 1)}>↓</button>
            </>}
            <button type="button" title="Set as cover" aria-label={`Set ${photo.name} as cover`} disabled={photo.isCover} onClick={() => void persist(() => send('/api/files/cover', 'POST', { targetType: target.kind, targetId: target.id, documentId: photo.id }))}>{photo.isCover ? 'Current cover' : 'Set cover'}</button>
            <button type="button" title="Remove photo" aria-label={`Remove ${photo.name}`} className={styles.remove} onClick={() => setRemoving(photo)}>Remove</button>
          </div>
        </div>
      </div>) : <p className={styles.empty}>No photos yet.</p>}
    </div>

    <div className={styles.documents}>
      <h4>{target.kind === 'property' ? 'Property documents' : 'Unit documents'}</h4>
      <FileList files={files} empty="No documents yet." />
    </div>

    <div className={styles.upload} id="photos">
      <div className={styles.uploadHeader}>
        <div role="group" aria-label="Upload type" className={styles.switch}>
          <button type="button" aria-pressed={mode === 'photo'} className={mode === 'photo' ? styles.selected : ''} onClick={() => setMode('photo')}>Photos</button>
          <button type="button" aria-pressed={mode === 'document'} className={mode === 'document' ? styles.selected : ''} onClick={() => setMode('document')}>Documents</button>
        </div>
        {max !== null && <span className={styles.count}>{photos.length} of {max} photos</span>}
      </div>
      {mode === 'photo' ? <FileUploader
        key={`photo-${photos.map((photo) => photo.id).join(',')}`}
        kind="photo" target={target} max={max ?? undefined} showCounter={false}
        existingCount={photos.length} onUploaded={() => { toast.success('Photo uploaded'); router.refresh(); }}
      /> : <FileUploader kind="document" target={target} onUploaded={() => { toast.success('Document uploaded'); router.refresh(); }} />}
      <p className={styles.note}>Repair photos stay on their maintenance requests and are not shown here.</p>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <ConfirmDialog open={!!removing} onClose={() => { if (!pending) setRemoving(null); }} title={`Remove ${removing?.caption ?? removing?.name ?? 'photo'}?`} description={removing?.isCover ? 'This will permanently remove the cover photo from this property or unit.' : 'This will permanently remove this photo. It cannot be undone.'} confirmLabel={pending ? 'Removing…' : 'Remove photo'} pending={pending} onConfirm={async () => {
      if (!removing || pending) return;
      setPending(true);
      const removed = await persist(() => send(`/api/files/${removing.id}`, 'DELETE'), 'Photo removed');
      setPending(false);
      if (removed) setRemoving(null);
    }} />
  </div>;
}
