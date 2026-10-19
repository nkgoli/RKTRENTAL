'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@/components/ui';
import styles from './lease-detail.module.css';
import { renameLeaseDocumentAction, type DocumentActionState } from './documentActions';

export type LeaseDocumentItem = {
  id: string;
  name: string;
  kind: string;
  uploaded: string;
  mimeType: string;
};

function DocumentCard({
  leaseId,
  document,
  onRemoved,
}: {
  leaseId: string;
  document: LeaseDocumentItem;
  onRemoved: (name: string) => void;
}) {
  const [renameState, rename, renaming] = useActionState(
    (_previous: DocumentActionState, form: FormData) => renameLeaseDocumentAction(form),
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const confirmation = useRef<HTMLDivElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmation.current?.focus();
  }, [confirming]);

  async function remove() {
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(document.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      onRemoved(document.name);
    } catch {
      setError('The file could not be deleted. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className={styles.documentCard}>
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
          <summary aria-label={`More actions for ${document.name}`}>More actions</summary>
          <div className={styles.menuPanel}>
            <a href={`/api/files/${document.id}/download`}>Download</a>
            <details className={styles.rename}>
              <summary>Rename</summary>
              <form action={rename} aria-label={`Rename ${document.name}`}>
                <input type="hidden" name="id" value={document.id} />
                <input type="hidden" name="leaseId" value={leaseId} />
                <label className="field">
                  New name
                  <input
                    aria-label={`New name for ${document.name}`}
                    name="name"
                    defaultValue={document.name}
                    required
                    maxLength={200}
                  />
                </label>
                <Button type="submit" variant="primary" disabled={renaming} aria-busy={renaming}>
                  {renaming ? 'Saving…' : 'Save name'}
                </Button>
                {renameState.message && (
                  <Alert tone={renameState.ok ? 'success' : 'error'}>{renameState.message}</Alert>
                )}
              </form>
            </details>
            <Button type="button" disabled title="Document sharing is not available">
              Share with tenant
            </Button>
            <button
              className="btn btn-danger"
              type="button"
              ref={removeButton}
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
            {confirming && (
              <div
                ref={confirmation}
                className={styles.confirmation}
                role="group"
                aria-label={`Delete ${document.name}`}
                tabIndex={-1}
              >
                <p>Delete {document.name}? This cannot be undone.</p>
                <div>
                  <Button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setConfirming(false);
                      setError('');
                      removeButton.current?.focus();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={deleting}
                    aria-busy={deleting}
                    onClick={() => void remove()}
                  >
                    {deleting ? 'Deleting…' : 'Confirm delete'}
                  </Button>
                </div>
              </div>
            )}
            {error && <Alert tone="error">{error}</Alert>}
          </div>
        </details>
      </div>
    </article>
  );
}

export function LeaseDocumentGrid({
  leaseId,
  documents,
}: {
  leaseId: string;
  documents: LeaseDocumentItem[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  return (
    <>
      {message && (
        <div ref={feedback} tabIndex={-1}>
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      {!documents.length && <p className="muted">No lease documents yet.</p>}
      <div className={styles.documentGrid} aria-label="Lease documents">
        {documents.map((document) => (
          <DocumentCard
            key={document.id}
            leaseId={leaseId}
            document={document}
            onRemoved={(name) => {
              setMessage(`${name} deleted.`);
              router.refresh();
            }}
          />
        ))}
      </div>
    </>
  );
}
