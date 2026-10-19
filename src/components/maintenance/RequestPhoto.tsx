'use client';

import { useState } from 'react';
import styles from './maintenance.module.css';

export function RequestPhoto({ documentId, title }: { documentId: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.photo}>
      {failed ? (
        <p className={styles.photoFallback}>Photo preview unavailable</p>
      ) : (
        // Authenticated file endpoint; preserve access checks and use a recoverable fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/files/${documentId}/preview`}
          alt={`${title} photo`}
          loading="lazy"
          width={320}
          height={160}
          onError={() => setFailed(true)}
        />
      )}
      <div className={styles.photoActions}>
        <a href={`/api/files/${documentId}/preview`} target="_blank" rel="noreferrer">
          Open photo<span className="sr-only"> (new tab)</span>
        </a>
        <a href={`/api/files/${documentId}/download`}>Download</a>
      </div>
    </div>
  );
}
