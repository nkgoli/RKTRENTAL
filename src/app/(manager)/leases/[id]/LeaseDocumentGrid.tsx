'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, ConfirmDialog, useToast } from '@/components/ui';
import { FileUploader, type UploadedDocument } from '@/components/upload';
import { formatDate } from '@/lib/properties/format';
import styles from './lease-detail.module.css';
import type { DocumentActionState } from './documentActions';
import { DOCUMENT_GROUPS, documentGroup, formatFileSize, isRestrictedKind } from './lease-view';

export type LeaseDocumentItem = {
  id: string;
  name: string;
  kind: string;
  uploaded: string;
  mimeType: string;
  /** "24 KB"; omitted when unknown. */
  size?: string;
  /** The executed agreement for this lease. */
  signed?: boolean;
};

const fileType = (mimeType: string) =>
  mimeType === 'application/pdf' ? 'PDF' : mimeType.startsWith('image/') ? 'IMG' : 'DOC';
const kindText = (kind: string) =>
  ({ lease: 'Lease', addendum: 'Addendum', inspection: 'Inspection', id: 'ID' })[kind] ??
  kind.charAt(0).toUpperCase() + kind.slice(1);

function DocumentRow({
  leaseId,
  document,
  onRemoved,
  onRenamed,
}: {
  leaseId: string;
  document: LeaseDocumentItem;
  onRemoved: (name: string) => void;
  onRenamed: (name: string) => void;
}) {
  const toast = useToast();
  const [renameState, rename, renaming] = useActionState(
    async (_previous: DocumentActionState, form: FormData): Promise<DocumentActionState> => {
      try {
        const response = await fetch(`/leases/${encodeURIComponent(leaseId)}/documents/rename`, {
          method: 'POST',
          body: form,
        });
        if (!response.ok) throw new Error('Rename failed');
        const state: DocumentActionState = await response.json();
        if (state.ok && state.name) {
          onRenamed(state.name);
          toast.success(state.message ?? 'Document renamed.');
        }
        return state;
      } catch {
        return { message: 'The file could not be renamed. Please try again.' };
      }
    },
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(document.name);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setName(document.name), [document.name]);
  const restricted = isRestrictedKind(document.kind);
  const previewable =
    document.mimeType === 'application/pdf' || document.mimeType.startsWith('image/');

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
    <article className={styles.fileRow}>
      <span className={styles.fileType} aria-hidden="true">
        {fileType(document.mimeType)}
      </span>
      <div className={styles.fileMeta}>
        <strong>{document.name}</strong>
        <small>
          {[kindText(document.kind), document.uploaded, document.size].filter(Boolean).join(' · ')}
        </small>
      </div>
      <div className={styles.fileBadges}>
        {document.signed && <Badge tone="success">Signed</Badge>}
        {restricted && (
          <span className={styles.restricted} title="Restricted access: identity document">
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Restricted
          </span>
        )}
      </div>
      <div className={styles.fileActions}>
        <a
          className="btn btn-secondary btn-sm"
          href={`/api/files/${document.id}/download`}
          aria-label={`Download ${document.name}`}
        >
          Download
        </a>
        <details className={styles.documentMenu}>
          <summary aria-label={`More actions for ${document.name}`}>More actions</summary>
          <div className={styles.menuPanel}>
            {previewable && (
              <a
                href={`/api/files/${document.id}/preview`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Preview ${document.name} (opens in a new tab)`}
              >
                Preview
              </a>
            )}
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
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={200}
                  />
                </label>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={renaming}
                  aria-busy={renaming}
                >
                  {renaming ? 'Saving…' : 'Save name'}
                </Button>
                {renameState.message && (
                  <Alert tone={renameState.ok ? 'success' : 'error'}>{renameState.message}</Alert>
                )}
              </form>
            </details>
            <Button type="button" size="sm" disabled title="Document sharing is not available">
              Share with tenant
            </Button>
            <button
              className="btn btn-danger btn-sm"
              type="button"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </div>
        </details>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => {
          if (!deleting) {
            setConfirming(false);
            setError('');
          }
        }}
        title={`Delete ${document.name}?`}
        description="This permanently removes the document. This cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Confirm delete'}
        pending={deleting}
        onConfirm={() => void remove()}
      >
        {error && <Alert tone="error">{error}</Alert>}
      </ConfirmDialog>
    </article>
  );
}

/**
 * Lease documents grouped as Signed agreement / Addendums / Inspections & IDs (plus other files),
 * each a file row with its download, preview, rename and confirmed delete.
 */
export function LeaseDocumentGrid({
  leaseId,
  documents,
  withUploader = false,
}: {
  leaseId: string;
  documents: LeaseDocumentItem[];
  withUploader?: boolean;
}) {
  const toast = useToast();
  const [items, setItems] = useState(documents);
  const [message, setMessage] = useState('');
  useEffect(() => setItems(documents), [documents]);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);

  function uploaded(file: UploadedDocument) {
    if (!file.id || !file.name) return;
    const bytes = Number(file.sizeBytes);
    const item: LeaseDocumentItem = {
      id: file.id,
      name: file.name,
      kind: String(file.kind).toLowerCase(),
      uploaded: formatDate(new Date(String(file.createdAt))),
      mimeType: String(file.mimeType),
      size: formatFileSize(Number.isFinite(bytes) ? bytes : undefined) || undefined,
    };
    // Each completed file updates independently; concurrent uploads and failed
    // items keep their progress/retry controls instead of navigating away.
    setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
    toast.success(`${item.name} uploaded.`);
  }
  const groups = DOCUMENT_GROUPS.map((group) => ({
    ...group,
    files: items.filter((item) => documentGroup(item.kind, item.signed) === group.key),
  })).filter((group) => group.files.length > 0 || group.key !== 'other');
  return (
    <>
      {message && (
        <div ref={feedback} tabIndex={-1}>
          <Alert tone="success">{message}</Alert>
        </div>
      )}
      {!items.length && <p className="muted">No lease documents yet.</p>}
      <div className={styles.documentGroups} aria-label="Lease documents">
        {groups.map((group) => (
          <section
            key={group.key}
            className={styles.documentGroup}
            aria-label={`${group.title} files`}
          >
            <h3 className="eyebrow">
              {group.title} <span className={styles.count}>{group.files.length}</span>
            </h3>
            {group.files.length ? (
              group.files.map((document) => (
                <DocumentRow
                  key={document.id}
                  leaseId={leaseId}
                  document={document}
                  onRenamed={(name) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.id === document.id ? { ...entry, name } : entry,
                      ),
                    )
                  }
                  onRemoved={(name) => {
                    setMessage(`${name} deleted.`);
                    toast.success(`${name} deleted.`);
                    setItems((current) => current.filter((entry) => entry.id !== document.id));
                  }}
                />
              ))
            ) : (
              <p className={styles.emptyGroup}>
                {group.key === 'signed'
                  ? 'No signed agreement stored on this lease.'
                  : group.key === 'addendums'
                    ? 'No addendums yet.'
                    : 'No inspections or IDs yet.'}
              </p>
            )}
          </section>
        ))}
      </div>
      {withUploader && (
        <div className={styles.uploader}>
          <FileUploader
            kind="document"
            target={{ kind: 'lease', id: leaseId }}
            documentKind="LEASE"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            label="Upload lease document"
            onUploaded={uploaded}
          />
        </div>
      )}
    </>
  );
}
