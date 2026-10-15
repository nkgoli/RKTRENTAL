'use client';

import { useRouter } from 'next/navigation';
import styles from './lease-detail.module.css';
import { renameLeaseDocumentAction } from './documentActions';

export type LeaseDocumentItem = {
  id: string;
  name: string;
  kind: string;
  uploaded: string;
  mimeType: string;
};

export function LeaseDocumentGrid({
  leaseId,
  documents,
}: {
  leaseId: string;
  documents: LeaseDocumentItem[];
}) {
  const router = useRouter();
  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    const response = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) router.refresh();
    else window.alert('The file could not be deleted. Please try again.');
  }
  if (!documents.length) return <p className="muted">No lease documents yet.</p>;
  return (
    <div className={styles.documentGrid} aria-label="Lease documents">
      {documents.map((document) => (
        <article className={styles.documentCard} key={document.id}>
          <div className={styles.documentIcon} aria-hidden="true">
            {document.mimeType === 'application/pdf'
              ? 'PDF'
              : document.mimeType.startsWith('image/')
                ? 'IMG'
                : 'DOC'}
          </div>
          <div className={styles.documentTitle}>
            <strong>{document.name}</strong>
            <small>
              {document.kind} · Uploaded {document.uploaded}
            </small>
          </div>
          <div className={styles.documentControls}>
            <a className="btn btn-secondary btn-sm" href={`/api/files/${document.id}/download`}>
              Download
            </a>
            <details className={styles.documentMenu}>
              <summary aria-label={`More actions for ${document.name}`} title="More actions">
                ⋮
              </summary>
              <div className={styles.menuPanel}>
                <a href={`/api/files/${document.id}/download`}>Download</a>
                <details className={styles.rename}>
                  <summary>Rename</summary>
                  <form action={renameLeaseDocumentAction}>
                    <input type="hidden" name="id" value={document.id} />
                    <input type="hidden" name="leaseId" value={leaseId} />
                    <input
                      aria-label={`New name for ${document.name}`}
                      name="name"
                      defaultValue={document.name}
                      required
                      maxLength={200}
                    />
                    <button type="submit">Save name</button>
                  </form>
                </details>
                <button type="button" disabled title="Document sharing is not available">
                  Share with tenant
                </button>
                <button
                  type="button"
                  className={styles.deleteAction}
                  onClick={() => void remove(document.id, document.name)}
                >
                  Delete
                </button>
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}
