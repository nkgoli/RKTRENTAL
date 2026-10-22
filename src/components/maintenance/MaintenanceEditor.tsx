'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, Steps } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  editorValues,
  priorityLabels,
  statusLabels,
  type EditorValues,
  type MaintenanceEditorData,
} from '@/lib/maintenance/editor';
import { EditorPhoto, editorDate } from './EditorPhoto';
import {
  STATUS_STEPS,
  activityEntries,
  photoLine,
  priorityTones,
  requestMeta,
  statusStep,
  statusTones,
} from './editor-view';
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
  // The editor's own history entry, kept so a same-document Back/Forward can be
  // intercepted before Next.js traverses away and unmounts the draft.
  const editorUrl = useRef('');
  const editorState = useRef<unknown>(null);
  const discardMode = useRef<'assign' | 'back' | 'traverse'>('assign');
  const pendingTraverse = useRef<string | null>(null);
  const navigationApi = useRef<Navigation | null>(null);
  const dirty = (Object.keys(values) as (keyof EditorValues)[]).some(
    (key) => values[key] !== baseline[key],
  );
  const hasUnsaved = dirty || Boolean(comment.trim()) || Boolean(file);
  const hasUnsavedRef = useRef(hasUnsaved);
  hasUnsavedRef.current = hasUnsaved;
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
  // Refresh the editor entry after every render so a restored entry keeps the
  // current Next.js tree instead of the destination's.
  useEffect(() => {
    editorUrl.current = window.location.href;
    editorState.current = window.history.state;
  });
  useEffect(() => {
    const navigation = window.navigation ?? null;
    navigationApi.current = navigation;
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
        toast.push({
          message: 'Wait for the current action to finish before leaving.',
          tone: 'info',
        });
        return;
      }
      if (hasUnsaved) {
        event.preventDefault();
        event.stopPropagation();
        discardMode.current = 'assign';
        setDiscardTo(link.href);
      }
    };
    // Same-document Back/Forward never fires beforeunload or a link click. The
    // Navigation API can cancel the traversal before it commits, which keeps the
    // editor entry and its forward history intact.
    const onNavigate = (event: NavigateEvent) => {
      if (event.navigationType !== 'traverse' || event.hashChange || event.downloadRequest) return;
      if (leaving.current) return;
      if (!hasUnsavedRef.current && !busy.current) return;
      if (!event.canIntercept) return;
      event.preventDefault();
      if (busy.current) {
        toast.push({
          message: 'Wait for the current action to finish before leaving.',
          tone: 'info',
        });
        return;
      }
      pendingTraverse.current = event.destination.key;
      discardMode.current = 'traverse';
      setDiscardTo(event.destination.url);
    };
    // Fallback for browsers without the Navigation API. Next.js listens for
    // popstate and would traverse to the previous route, unmounting the editor.
    // A capture listener runs first, so stop that traversal, restore the editor
    // entry and let the manager choose stay or discard.
    const onPopState = (event: PopStateEvent) => {
      if (navigation) return;
      if (leaving.current) return;
      if (!hasUnsavedRef.current && !busy.current) return;
      event.stopImmediatePropagation();
      const destination = window.location.href;
      try {
        window.history.pushState(editorState.current, '', editorUrl.current);
      } catch {
        return;
      }
      if (busy.current) {
        toast.push({
          message: 'Wait for the current action to finish before leaving.',
          tone: 'info',
        });
        return;
      }
      discardMode.current = 'back';
      setDiscardTo(destination);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    window.addEventListener('popstate', onPopState, true);
    navigation?.addEventListener('navigate', onNavigate);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
      window.removeEventListener('popstate', onPopState, true);
      navigation?.removeEventListener('navigate', onNavigate);
    };
  }, [hasUnsaved, toast]);

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
  const step = statusStep(record.status);
  const activity = activityEntries(record);
  const missingDescription = !record.description?.trim();

  return (
    <div className={styles.editor}>
      <PageHeader
        title="Edit request"
        eyebrow="Operations"
        meta={requestMeta(record)}
        back={{ href: returnTo, label: 'Maintenance' }}
        actions={[]}
      />
      <div className={styles.toolbar}>
        <div className={styles.badges}>
          <Badge tone={statusTones[record.status]}>{statusLabels[record.status]}</Badge>
          <Badge tone={priorityTones[record.priority]}>
            {priorityLabels[record.priority]} priority
          </Badge>
        </div>
        <span role="status" className={dirty ? styles.pendingLabel : styles.savedLabel}>
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
      </div>
      {feedbackFor('save')}
      <div className={`${styles.layout} ${missingDescription ? styles.withAlert : ''}`}>
        {missingDescription && (
          <div className={styles.alertArea}>
            <Alert tone="warning">
              <div>
                <strong>No description yet</strong>
                <p>Add the symptoms and access instructions so the vendor can prepare.</p>
              </div>
            </Alert>
          </div>
        )}
        <section className={`card ${styles.details}`} aria-labelledby="details-heading">
          <h2 id="details-heading">Request details</h2>
          {step >= 0 ? (
            <div aria-label={`Status: ${statusLabels[record.status]}`} role="group">
              <Steps steps={STATUS_STEPS} current={step} />
            </div>
          ) : (
            <p className={styles.fieldHint}>
              This request is cancelled. Its photos, comments and history remain available.
            </p>
          )}
          <div className={styles.location}>
            <strong>
              {record.property.name} · Unit {record.unit.number}
            </strong>
            <small>Location stays with this request.</small>
          </div>
          <form
            id="repair-editor"
            aria-label="Edit repair request"
            onSubmit={submit}
            className={styles.editForm}
            aria-busy={pending === 'save'}
          >
            <fieldset disabled={Boolean(pending)} className={styles.fields}>
              <label className="field">
                Title
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
                  rows={5}
                  onChange={(event) => change('description', event.target.value)}
                  placeholder="Symptoms, when it started and access instructions for the vendor"
                />
              </label>
              <div className={styles.selects}>
                <label className="field">
                  Status
                  <select
                    name="status"
                    value={values.status}
                    onChange={(event) =>
                      change('status', event.target.value as EditorValues['status'])
                    }
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
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
                  Assign vendor
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
              </div>
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
            </fieldset>
          </form>
          <form
            aria-label="Upload request photo"
            className={styles.photos}
            onSubmit={(event) => {
              event.preventDefault();
              if (file) void perform('photo');
            }}
            aria-busy={pending === 'photo'}
          >
            <fieldset disabled={Boolean(pending)} className={styles.upload}>
              <div className={styles.photoRow}>
                <span className={styles.photoSummary}>
                  <PhotoGlyph />
                  <span>{photoLine(record.photos)}</span>
                </span>
                <label className={`btn btn-secondary btn-sm ${styles.filePicker}`}>
                  <span>Add photos</span>
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
              </div>
              <span className={styles.fieldHint}>
                JPG, PNG or HEIC · up to 25 MB · photos upload immediately and stay when you cancel
              </span>
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
            {record.photos.length > 0 && (
              <div className={styles.gallery}>
                {record.photos.map((photo, index) => (
                  <EditorPhoto key={photo.documentId} photo={photo} index={index} />
                ))}
              </div>
            )}
          </form>
          <div className={styles.actions}>
            <p className={styles.fieldHint}>
              {dirty
                ? 'Details, status, priority and vendor are pending until you save.'
                : 'Details, status, priority and vendor are up to date.'}
            </p>
            <div className={styles.actionButtons}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={Boolean(pending)}
                onClick={() => {
                  if (hasUnsaved) {
                    discardMode.current = 'assign';
                    setDiscardTo(returnTo);
                  } else window.location.assign(returnTo);
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
                <Icon name="check" />
                {pending === 'save' ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </section>
        <div className={styles.side}>
          <section className={`card ${styles.activity}`} aria-labelledby="activity-heading">
            <h2 id="activity-heading">
              Activity <span className={styles.count}>{activity.length}</span>
            </h2>
            {activity.length ? (
              <ol className={styles.timeline}>
                {(allActivity ? activity : activity.slice(0, 8)).map((entry) => (
                  <li key={entry.id}>
                    <div className={styles.eventHeading}>
                      <strong>{entry.title}</strong>
                      <time dateTime={entry.createdAt}>{editorDate(entry.createdAt)}</time>
                    </div>
                    {entry.author && <p className={styles.eventAuthor}>{entry.author}</p>}
                    {entry.comment && entry.body && (
                      <p className={styles.commentBody}>{entry.body}</p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.fieldHint}>No activity recorded yet. Add the first update.</p>
            )}
            {activity.length > 8 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAllActivity(!allActivity)}
              >
                {allActivity ? 'Show recent activity' : `Show all ${activity.length} updates`}
              </button>
            )}
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
                <p className={styles.fieldHint}>Comments post immediately.</p>
                <button
                  className="btn btn-secondary btn-sm"
                  type="submit"
                  disabled={Boolean(pending) || !comment.trim()}
                >
                  {pending === 'comment' ? 'Posting…' : 'Post comment'}
                </button>
              </div>
              {feedbackFor('comment')}
            </form>
          </section>
          <section className={styles.requestContext} aria-labelledby="record-heading">
            <h2 id="record-heading">Request record</h2>
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
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(discardTo)}
        onClose={() => setDiscardTo(undefined)}
        title="Discard unsaved changes?"
        description="Your pending edits, unposted comment and selected upload will be discarded. Photos and comments already saved will remain."
        confirmLabel="Discard changes"
        onConfirm={() => {
          leaving.current = true;
          if (
            discardMode.current === 'traverse' &&
            pendingTraverse.current &&
            navigationApi.current
          ) {
            try {
              navigationApi.current
                .traverseTo(pendingTraverse.current)
                .finished?.catch(() => window.location.assign(discardTo!));
            } catch {
              window.location.assign(discardTo!);
            }
          } else if (discardMode.current === 'back') {
            // The fallback already sits on the destination entry, so going back
            // reaches it without adding a duplicate entry or a loop.
            window.history.back();
          } else {
            window.location.assign(discardTo!);
          }
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

function PhotoGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="2.5" y="4" width="15" height="12" rx="2" fill="none" stroke="currentColor" />
      <circle cx="7.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" />
      <path d="m3 14 4.5-4 3.5 3 2.5-2 4 3.5" fill="none" stroke="currentColor" />
    </svg>
  );
}
