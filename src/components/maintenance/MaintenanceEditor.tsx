'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import {
  editorValues,
  eventLabel,
  priorityLabels,
  statusLabels,
  type EditorValues,
  type MaintenanceEditorData,
} from '@/lib/maintenance/editor';
import { EditorPhoto, editorDate } from './EditorPhoto';
import styles from './editor.module.css';

type Vendor = {
  id: string;
  name: string;
  trade: string | null;
  phone: string | null;
  email: string | null;
};
type Result = { error?: string; message?: string; request?: MaintenanceEditorData };
type Operation = 'save' | 'comment' | 'photo';

export function MaintenanceEditor({
  initial,
  vendors,
  returnTo,
}: {
  initial: MaintenanceEditorData;
  vendors: Vendor[];
  returnTo: string;
}) {
  const toast = useToast();
  const [record, setRecord] = useState(initial);
  const [values, setValues] = useState(() => editorValues(initial));
  const [baseline, setBaseline] = useState(() => editorValues(initial));
  const [revision, setRevision] = useState(initial.updatedAt);
  const [comment, setComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string>();
  const [pending, setPending] = useState<Operation | null>(null);
  const busy = useRef(false);
  const leaving = useRef(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState<{
    operation: Operation;
    error?: string;
    message?: string;
  }>();
  const [titleError, setTitleError] = useState('');
  const [discardTo, setDiscardTo] = useState<string>();
  const [cancelRequest, setCancelRequest] = useState(false);
  const [allActivity, setAllActivity] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const feedbackElement = useRef<HTMLParagraphElement>(null);
  const dirty = (Object.keys(values) as (keyof EditorValues)[]).some(
    (key) => values[key] !== baseline[key],
  );
  const hasUnsaved = dirty || Boolean(comment.trim()) || Boolean(file);
  const vendor = vendors.find((item) => item.id === values.vendorId);
  const change = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    if (key === 'title') setTitleError('');
    if (feedback?.operation === 'save') setFeedback(undefined);
  };
  useEffect(() => {
    if (!file || !['image/jpeg', 'image/png'].includes(file.type)) {
      setLocalPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    feedbackElement.current?.focus();
  }, [feedback]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!leaving.current && (hasUnsaved || busy.current)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.pathname.startsWith('/api/files/') ||
        destination.protocol !== window.location.protocol
      )
        return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      )
        return;
      if (busy.current) {
        event.preventDefault();
        return;
      }
      if (hasUnsaved) {
        event.preventDefault();
        event.stopPropagation();
        setDiscardTo(link.href);
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [hasUnsaved]);

  async function perform(operation: Operation) {
    if (busy.current) return;
    busy.current = true;
    setPending(operation);
    setFeedback(undefined);
    setProgress(0);
    const data = new FormData();
    data.set('propertyId', record.propertyId);
    data.set('scopeUnitId', record.unit.id);
    data.set('operation', operation);
    if (operation === 'save') {
      for (const [key, value] of Object.entries(values)) data.set(key, value);
      data.set('updatedAt', revision);
    }
    if (operation === 'comment') data.set('comment', comment);
    if (operation === 'photo' && file) data.set('photo', file);
    try {
      const url = `/maintenance/${record.id}/edit/data`;
      const result: Result =
        operation === 'photo'
          ? await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', url);
              xhr.responseType = 'json';
              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable)
                  setProgress(Math.round((event.loaded / event.total) * 100));
              };
              xhr.onload = () =>
                xhr.status >= 200 && xhr.status < 300 && xhr.response
                  ? resolve(xhr.response)
                  : reject(new Error('Upload failed'));
              xhr.onerror = () => reject(new Error('Upload failed'));
              xhr.send(data);
            })
          : await (async () => {
              const response = await fetch(url, { method: 'POST', body: data });
              if (!response.ok) throw new Error('Action failed');
              return response.json();
            })();
      if (result.error) {
        setFeedback({ operation, error: result.error });
        return;
      }
      if (!result.message) throw new Error('Missing result');
      if (result.request) {
        setRecord(result.request);
        // A clean editor may adopt newer server fields; a dirty one keeps its original
        // revision so another manager's changes cannot be overwritten silently.
        if (operation === 'save' || !dirty) {
          const saved = editorValues(result.request);
          setValues(saved);
          setBaseline(saved);
          setRevision(result.request.updatedAt);
        }
      }
      if (operation === 'comment') setComment('');
      if (operation === 'photo') {
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
      }
      setFeedback({ operation, message: result.message });
      toast.success(result.message);
    } catch {
      setFeedback({
        operation,
        error:
          'Could not confirm this action. Your input is still here. Check the request in another tab before retrying.',
      });
    } finally {
      busy.current = false;
      setPending(null);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.title.trim()) {
      setTitleError('Enter a request title.');
      titleInput.current?.focus();
      return;
    }
    if (values.status === 'CANCELLED' && baseline.status !== 'CANCELLED') setCancelRequest(true);
    else void perform('save');
  }
  const actionButtons = (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={Boolean(pending)}
        onClick={() => {
          if (hasUnsaved) setDiscardTo(returnTo);
          else window.location.assign(returnTo);
        }}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="repair-editor"
        className="btn btn-primary"
        disabled={Boolean(pending) || !dirty}
      >
        {pending === 'save' ? 'Saving request…' : 'Save request'}
      </button>
    </>
  );
  const feedbackFor = (operation: Operation) =>
    feedback?.operation === operation && (
      <p
        ref={feedbackElement}
        tabIndex={-1}
        role={feedback.error ? 'alert' : 'status'}
        className={feedback.error ? styles.error : styles.success}
      >
        {feedback.error ?? feedback.message}
      </p>
    );

  return (
    <div className={styles.editor}>
      <PageHeader
        title={record.title}
        eyebrow="Maintenance / Edit request"
        meta={`${record.property.name} · Unit ${record.unit.number}`}
        back={{ href: returnTo, label: 'Repair requests' }}
        actions={[]}
      />
      <div className={styles.toolbar}>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles[`status${record.status}`]}`}>
            {statusLabels[record.status]}
          </span>
          <span className={`${styles.badge} ${styles[`priority${record.priority}`]}`}>
            {priorityLabels[record.priority]} priority
          </span>
          <span className={styles.savedHint}>Saved request</span>
        </div>
        <div className={styles.toolbarActions}>
          <span role="status" className={dirty ? styles.pendingLabel : styles.savedLabel}>
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          {actionButtons}
        </div>
      </div>
      {feedbackFor('save')}
      <form
        id="repair-editor"
        aria-label="Edit repair request"
        onSubmit={submit}
        className={styles.editForm}
        aria-busy={pending === 'save'}
      >
        <fieldset disabled={Boolean(pending)} className={styles.editGrid}>
          <section className={styles.card} aria-labelledby="details-heading">
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <Icon name="maintenance" />
              </span>
              <div>
                <h2 id="details-heading">Request details</h2>
                <p>Describe the issue and what needs attention.</p>
              </div>
            </div>
            <label className="field">
              Request title
              <input
                ref={titleInput}
                name="title"
                aria-required="true"
                value={values.title}
                maxLength={160}
                onChange={(event) => change('title', event.target.value)}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? 'title-error' : undefined}
              />
            </label>
            {titleError && (
              <p id="title-error" className={styles.fieldError}>
                {titleError}
              </p>
            )}
            <label className="field">
              Description
              <textarea
                name="description"
                value={values.description}
                maxLength={3000}
                rows={6}
                onChange={(event) => change('description', event.target.value)}
                placeholder="What needs attention? Include location, symptoms and access instructions."
              />
            </label>
            <p className={styles.fieldHint}>
              Include access instructions to help the vendor prepare.
            </p>
          </section>
          <aside
            className={`${styles.card} ${styles.operations}`}
            aria-labelledby="operations-heading"
          >
            <div className={styles.sectionHead}>
              <div>
                <h2 id="operations-heading">Manage request</h2>
                <p>Saved together with request details.</p>
              </div>
            </div>
            <label className="field">
              Priority
              <select
                name="priority"
                value={values.priority}
                onChange={(event) =>
                  change('priority', event.target.value as EditorValues['priority'])
                }
              >
                {Object.entries(priorityLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Status
              <select
                name="status"
                value={values.status}
                onChange={(event) => change('status', event.target.value as EditorValues['status'])}
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Assigned vendor
              <select
                name="vendorId"
                value={values.vendorId}
                disabled={!vendors.length}
                onChange={(event) => change('vendorId', event.target.value)}
              >
                <option value="" disabled={Boolean(baseline.vendorId)}>
                  Unassigned
                </option>
                {vendors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {!vendors.length && (
              <p className={styles.fieldHint}>No vendors are available for this portfolio.</p>
            )}
            {values.vendorId !== baseline.vendorId &&
              values.vendorId &&
              values.status === 'NEW' && (
                <p className={styles.operationHint}>
                  Assigning a vendor moves a new request to Assigned when saved.
                </p>
              )}
            {vendor && (vendor.trade || vendor.phone || vendor.email) && (
              <div className={styles.vendorContact}>
                {vendor.trade && <strong>{vendor.trade}</strong>}
                {vendor.phone && <a href={`tel:${vendor.phone}`}>{vendor.phone}</a>}
                {vendor.email && <a href={`mailto:${vendor.email}`}>{vendor.email}</a>}
              </div>
            )}
            <div className={styles.context}>
              <Icon name="properties" />
              <div>
                <strong>{record.property.name}</strong>
                <p>Unit {record.unit.number}</p>
                <small>Location stays with this request.</small>
              </div>
            </div>
          </aside>
        </fieldset>
        <div className={styles.saveStrip}>
          <p>
            {dirty
              ? 'Details, priority, vendor and status are pending until you save.'
              : 'Details, priority, vendor and status are up to date.'}
          </p>
          <div>{actionButtons}</div>
        </div>
      </form>
      <div className={styles.supportGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.card} aria-labelledby="photos-heading">
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <Icon name="documents" />
              </span>
              <div>
                <h2 id="photos-heading">
                  Photos <span className={styles.count}>{record.photos.length}</span>
                </h2>
                <p>Upload immediately. Unsaved request edits stay here.</p>
              </div>
            </div>
            {record.photos.length ? (
              <div className={styles.gallery}>
                {record.photos.map((photo, index) => (
                  <EditorPhoto key={photo.documentId} photo={photo} index={index} />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <Icon name="documents" />
                <div>
                  <strong>No photos yet</strong>
                  <p>Add a clear photo of the issue to help the vendor prepare.</p>
                </div>
              </div>
            )}
            <form
              aria-label="Upload request photo"
              onSubmit={(event) => {
                event.preventDefault();
                if (file) void perform('photo');
              }}
              aria-busy={pending === 'photo'}
            >
              <fieldset disabled={Boolean(pending)} className={styles.upload}>
                <label className={styles.filePicker}>
                  <span>Choose photo</span>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".jpg,.jpeg,.png,.heic,.heif"
                    aria-label="Choose request photo"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      setFeedback(undefined);
                      if (!selected) return;
                      if (
                        selected.size > 25 * 1024 * 1024 ||
                        !/\.(jpe?g|png|hei[cf])$/i.test(selected.name)
                      ) {
                        setFeedback({
                          operation: 'photo',
                          error: 'Choose a JPG, PNG or HEIC photo up to 25 MB.',
                        });
                        event.target.value = '';
                        setFile(null);
                        return;
                      }
                      setFile(selected);
                    }}
                  />
                </label>
                <span className={styles.fieldHint}>JPG, PNG or HEIC · up to 25 MB</span>
                {file && (
                  <div className={styles.selectedFile}>
                    {localPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={localPreview} alt="Selected photo preview" />
                    )}
                    <div>
                      <strong>{file.name}</strong>
                      <small>{(file.size / 1024).toFixed(0)} KB · Not uploaded yet</small>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileInput.current) fileInput.current.value = '';
                      }}
                    >
                      Remove
                    </button>
                    <button className="btn btn-primary btn-sm" type="submit">
                      Upload photo
                    </button>
                  </div>
                )}
              </fieldset>
              {pending === 'photo' && (
                <div role="status" className={styles.uploadProgress}>
                  <progress max={100} value={progress} aria-label="Photo upload progress" />
                  <span>
                    {progress < 100
                      ? `Uploading photo… ${progress}%`
                      : 'Upload received. Saving photo…'}
                  </span>
                </div>
              )}
              {feedbackFor('photo')}
            </form>
          </section>
          <section className={styles.card} aria-labelledby="activity-heading">
            <div className={styles.sectionHead}>
              <div>
                <h2 id="activity-heading">
                  Activity <span className={styles.count}>{record.events.length}</span>
                </h2>
                <p>Updates and conversations for this request.</p>
              </div>
            </div>
            <form
              aria-label="Add request comment"
              className={styles.composer}
              onSubmit={(event) => {
                event.preventDefault();
                if (comment.trim()) void perform('comment');
              }}
              aria-busy={pending === 'comment'}
            >
              <label className="field">
                Add a comment
                <textarea
                  name="comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  disabled={Boolean(pending)}
                  placeholder="Share a visit window, repair update or next step…"
                />
              </label>
              <div className={styles.composerFooter}>
                <p>Comments post immediately.</p>
                <button
                  className="btn btn-secondary"
                  type="submit"
                  disabled={Boolean(pending) || !comment.trim()}
                >
                  {pending === 'comment' ? 'Posting…' : 'Post comment'}
                </button>
              </div>
              {feedbackFor('comment')}
            </form>
            {record.events.length ? (
              <ol className={styles.timeline}>
                {(allActivity ? record.events : record.events.slice(0, 8)).map((event) => (
                  <li key={event.id}>
                    <span
                      className={`${styles.eventDot} ${event.kind === 'COMMENT' ? styles.commentDot : ''}`}
                      aria-hidden="true"
                    >
                      {event.kind === 'COMMENT' ? event.actor?.name?.trim().charAt(0) || '•' : '•'}
                    </span>
                    <div>
                      <div className={styles.eventHeading}>
                        <strong>
                          {event.kind === 'COMMENT' && event.actor?.name
                            ? event.actor.name
                            : eventLabel(event)}
                        </strong>
                        <time dateTime={event.createdAt}>{editorDate(event.createdAt)}</time>
                      </div>
                      {event.kind !== 'COMMENT' && event.actor?.name && (
                        <p className={styles.eventAuthor}>{event.actor.name}</p>
                      )}
                      {event.kind === 'COMMENT' && (
                        <p className={styles.commentBody}>{event.body}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.empty}>
                <p>No activity recorded yet. Add the first update above.</p>
              </div>
            )}
            {record.events.length > 8 && (
              <button
                type="button"
                className={styles.moreActivity}
                onClick={() => setAllActivity(!allActivity)}
              >
                {allActivity ? 'Show recent activity' : `Show all ${record.events.length} updates`}
              </button>
            )}
          </section>
        </div>
        <aside className={styles.requestContext} aria-label="Request record">
          <h2>Request record</h2>
          <dl>
            <div>
              <dt>Opened</dt>
              <dd>
                <time dateTime={record.createdAt}>{editorDate(record.createdAt)}</time>
              </dd>
            </div>
            {record.completedAt && (
              <div>
                <dt>Completed</dt>
                <dd>
                  <time dateTime={record.completedAt}>{editorDate(record.completedAt)}</time>
                </dd>
              </div>
            )}
            <div>
              <dt>Saved status</dt>
              <dd>{statusLabels[record.status]}</dd>
            </div>
            <div>
              <dt>Saved vendor</dt>
              <dd>{record.vendor?.name ?? record.vendorName ?? 'Unassigned'}</dd>
            </div>
          </dl>
          <p>Photos and comments are saved immediately and remain when you cancel editing.</p>
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(discardTo)}
        onClose={() => setDiscardTo(undefined)}
        title="Discard unsaved changes?"
        description="Your pending edits, unposted comment and selected upload will be discarded. Photos and comments already saved will remain."
        confirmLabel="Discard changes"
        onConfirm={() => {
          leaving.current = true;
          window.location.assign(discardTo!);
        }}
      />
      <ConfirmDialog
        open={cancelRequest}
        onClose={() => setCancelRequest(false)}
        title="Cancel this repair request?"
        description="Save your edits and close this request as cancelled. Its photos, comments and history remain available."
        confirmLabel="Save and cancel request"
        onConfirm={() => {
          setCancelRequest(false);
          void perform('save');
        }}
      />
    </div>
  );
}
