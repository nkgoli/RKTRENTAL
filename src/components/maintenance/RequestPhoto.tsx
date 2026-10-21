'use client';

import { useState } from 'react';
import { Dialog, Button } from '@/components/ui';
import styles from './maintenance.module.css';

export function RequestPhoto({ documentId, title }: { documentId: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.photo}>
      <button
        type="button"
        className={styles.photoButton}
        aria-label={`Open ${title} photo`}
        onClick={() => setOpen(true)}
      >
        {failed ? (
          <p className={styles.photoFallback}>Photo preview unavailable</p>
        ) : (
          // Authenticated file endpoint; preserve access checks and use a recoverable fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${documentId}/preview`}
            alt={`${title} photo`}
            loading="lazy"
            width={120}
            height={120}
            onError={() => setFailed(true)}
          />
        )}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${title} photo`}
        size="lg"
        footer={
          <Button href={`/api/files/${documentId}/download`} variant="secondary">
            Download
          </Button>
        }
      >
        {failed ? (
          <p>Photo preview unavailable. You can still download the original file.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.fullPhoto}
            src={`/api/files/${documentId}/preview`}
            alt={`${title} photo, full size`}
            onError={() => setFailed(true)}
          />
        )}
      </Dialog>
    </div>
  );
}
