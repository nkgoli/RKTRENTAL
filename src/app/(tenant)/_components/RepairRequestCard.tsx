'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Progress } from '@/components/ui/Feedback';
import { repairProgress, repairStatusLabel } from '@/lib/tenant-portal/core';
import { parseDescription } from '../repairs/format';
import styles from '../repairs/repairs.module.css';

type RepairPhoto = { id: string; src: string; alt: string };
type Request = {
  id: string;
  title: string;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  category?: string | null;
  description?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
  vendorName?: string | null;
  photos?: RepairPhoto[];
};

const statusTone: Record<Request['status'], BadgeTone> = {
  NEW: 'info',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  CANCELLED: 'neutral',
};
const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function RepairPhotoThumbnail({ photo }: { photo: RepairPhoto }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div
        className={styles.photoFallback}
        role="img"
        aria-label={`${photo.alt} — photo unavailable`}
      >
        Photo unavailable
      </div>
    );
  }
  return (
    <>
      <button
        className={styles.thumbnail}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${photo.alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={image}
          src={photo.src}
          alt={photo.alt}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={photo.alt} size="lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.lightboxImage} src={photo.src} alt={photo.alt} />
      </Dialog>
    </>
  );
}

/** Shared tenant history card: truthful category, labelled progress and authorized photo URLs. */
export function RepairRequestCard({
  request,
  children,
  action,
}: {
  request: Request;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const description = parseDescription(request.description ?? null);
  const category = request.category?.trim() || description.category;
  const step = request.status === 'DONE' ? 2 : request.status === 'NEW' ? 0 : 1;
  return (
    <article className={`card ${styles.request}`} id={`request-${request.id}`}>
      <div className={styles.requestHeading}>
        <h3>{request.title}</h3>
        <Badge tone={statusTone[request.status]}>{repairStatusLabel(request.status)}</Badge>
      </div>
      <p className={styles.requestMeta}>
        {category} ·{' '}
        {request.status === 'DONE' && request.completedAt
          ? `Completed ${shortDate(request.completedAt)}`
          : `Submitted ${shortDate(request.createdAt)}`}
        {request.vendorName ? ` · Vendor: ${request.vendorName}` : ''}
      </p>
      {request.status !== 'CANCELLED' && (
        <>
          <Progress
            value={repairProgress(request.status)}
            label={`${request.title} repair progress`}
          />
          <ol className={styles.progressLabels} aria-label="Repair stages">
            {['Received', 'Scheduled', 'Done'].map((label, index) => (
              <li key={label} aria-current={index === step ? 'step' : undefined}>
                {label}
              </li>
            ))}
          </ol>
        </>
      )}
      {description.text && <p className={styles.description}>{description.text}</p>}
      {!!request.photos?.length && (
        <div className={styles.photos}>
          {request.photos.map((photo) => (
            <RepairPhotoThumbnail key={photo.id} photo={photo} />
          ))}
        </div>
      )}
      {children}
      {action && <div className={styles.requestAction}>{action}</div>}
    </article>
  );
}
