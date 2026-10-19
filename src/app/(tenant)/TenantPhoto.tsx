'use client';

import { useState } from 'react';
import styles from './portal.module.css';

export function TenantPhoto({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`photo ${styles.photo}`}>
      {failed ? (
        <div className={styles.photoFallback} role="img" aria-label={`${alt} — photo unavailable`}>
          <strong>Photo unavailable</strong>
          <span>{alt}</span>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            ref={(image) => {
              // A failed response can finish before hydration attaches onError.
              if (image?.complete && image.naturalWidth === 0) setFailed(true);
            }}
            onError={() => setFailed(true)}
            loading="lazy"
          />
          {caption && <span className="caption">{caption}</span>}
        </>
      )}
    </div>
  );
}
