'use client';
import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import type { MaintenanceEditorData } from '@/lib/maintenance/editor';
import styles from './editor.module.css';

export const editorDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC';

export function EditorPhoto({
  photo,
  index,
}: {
  photo: MaintenanceEditorData['photos'][number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = photo.document?.name ?? `Request photo ${index + 1}`;
  const url = `/api/files/${photo.documentId}/preview`;
  return (
    <figure className={styles.photo}>
      <button
        type="button"
        className={styles.thumbnail}
        onClick={() => setOpen(true)}
        aria-label={`Preview ${name}`}
      >
        {failed ? (
          <span>
            Preview unavailable
            <br />
            <small>Open for download</small>
          </span>
        ) : (
          // Authenticated endpoint retains file access checks.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} onError={() => setFailed(true)} loading="lazy" />
        )}
        <span className={styles.photoOverlay}>View photo ↗</span>
      </button>
      <figcaption>
        <strong title={name}>{name}</strong>
        <time dateTime={photo.createdAt}>{editorDate(photo.createdAt)}</time>
      </figcaption>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        eyebrow="Request photo"
        size="lg"
        footer={
          <a className="btn btn-secondary" href={`/api/files/${photo.documentId}/download`}>
            Download original
          </a>
        }
      >
        {failed ? (
          <p>Photo preview unavailable. Download the original to view this file.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.fullPhoto} src={url} alt={name} onError={() => setFailed(true)} />
        )}
      </Dialog>
    </figure>
  );
}
