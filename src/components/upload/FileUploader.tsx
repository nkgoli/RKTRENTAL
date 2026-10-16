'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FileTarget } from '@/lib/storage/types';
import { MAX_FILE_BYTES } from '@/lib/storage/types';
import { validateUploadMeta } from '@/lib/storage/validation';
import { photoLimitForTarget } from '@/lib/storage/photo-limits';
import styles from './FileUploader.module.css';

export type FileUploaderKind = 'photo' | 'document';
export type FileUploaderTarget = FileTarget | { type: FileTarget['kind']; id: string };

export interface UploadedDocument {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface FileUploaderItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  previewUrl?: string;
  isCover: boolean;
  document?: UploadedDocument;
}

export interface ExistingUploadedFile {
  id: string;
  name: string;
  sizeBytes?: number;
  previewUrl?: string;
  isCover?: boolean;
}

function ItemThumbnail({ item }: { item: FileUploaderItem }) {
  const [broken, setBroken] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setBroken(true);
  }, [item.previewUrl]);
  return item.previewUrl && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imageRef} className={styles.thumbnail} src={item.previewUrl} alt="" onError={() => setBroken(true)} />
  ) : (
    <span className={styles.fileIcon} role="img" aria-label={item.previewUrl ? `Preview unavailable for ${item.name}` : `${item.name} file type`}>
      {item.previewUrl ? 'Preview unavailable' : (extensionOf(item.name).replace('.', '') || 'file').toUpperCase()}
    </span>
  );
}

export interface UploadProgressContext {
  target: FileTarget;
  kind: FileUploaderKind;
  /** Storage document kind sent to the API, e.g. LEASE or NOTICE. Defaults from kind. */
  documentKind?: string;
  onProgress: (percent: number) => void;
}

export type UploadFileFn = (
  file: File,
  context: UploadProgressContext,
) => Promise<UploadedDocument>;

export interface FileUploaderProps {
  /** Hide the inline count when a parent upload area presents its own photo counter. */
  showCounter?: boolean;
  accept?: string;
  kind: FileUploaderKind | 'PHOTO' | 'DOCUMENT';
  /** Where files are stored. Omit with formField to submit files with an enclosing form. */
  target?: FileUploaderTarget;
  /**
   * Form-attached mode: files are not uploaded immediately. They are validated, previewed and
   * attached to a hidden input with this name, so the enclosing form submits them.
   */
  formField?: string;
  /** Accept several files (default) or a single replaceable file. */
  multiple?: boolean;
  /** Storage document kind sent to the API (LEASE, NOTICE, ...). Defaults from kind. */
  documentKind?: string;
  /** Files already stored on the target; shown as uploaded items that count toward the limit. */
  initialFiles?: ExistingUploadedFile[];
  /** Called before an already uploaded item is removed; throw to keep it. */
  onRemove?: (item: FileUploaderItem) => void | Promise<void>;
  max?: number;
  /** Photos already stored on the target, counted toward the photo counter. */
  existingCount?: number;
  /** Alias for existingCount. */
  initialUsed?: number;
  onUploaded?: (document: UploadedDocument, item: FileUploaderItem) => void;
  /** Optional control shown beside each uploaded file, such as a document type picker. */
  renderItemAction?: (item: FileUploaderItem) => ReactNode;
  onOrderChange?: (items: FileUploaderItem[]) => void;
  onCoverChange?: (item: FileUploaderItem | null) => void;
  /** Injectable transport for tests; defaults to POST /api/files with progress. */
  uploadFile?: UploadFileFn;
  label?: string;
}

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];
const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx';

function normalizeTarget(target: FileUploaderTarget | undefined): FileTarget {
  if (!target) return { kind: 'property', id: '' };
  if ('kind' in target) return target;
  return { kind: target.type, id: target.id };
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
}

function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const ext = extensionOf(file.name);
  const mime = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return token === ext;
    if (token.endsWith('/*')) return mime.startsWith(token.slice(0, -1));
    return token === mime;
  });
}

function defaultUploadFile(
  file: File,
  { target, kind, documentKind, onProgress }: UploadProgressContext,
): Promise<UploadedDocument> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.set('file', file);
    body.set('targetType', target.kind);
    body.set('targetId', target.id);
    body.set('kind', documentKind ?? (kind === 'photo' ? 'PHOTO' : 'OTHER'));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let parsed: { file?: UploadedDocument; error?: string } = {};
      try {
        parsed = JSON.parse(xhr.responseText) as typeof parsed;
      } catch {
        parsed = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(parsed.file ?? { name: file.name });
      } else {
        reject(new Error(parsed.error ?? 'The file could not be uploaded.'));
      }
    };
    xhr.onerror = () => reject(new Error('The file could not be uploaded.'));
    xhr.send(body);
  });
}

let itemSequence = 0;

export function FileUploader(props: FileUploaderProps) {
  const kind: FileUploaderKind =
    String(props.kind).toLowerCase() === 'photo' ? 'photo' : 'document';
  const target = normalizeTarget(props.target);
  const existing = props.existingCount ?? props.initialUsed ?? 0;
  const formField = props.formField;
  const multiple = props.multiple ?? true;
  const defaultMax =
    kind === 'photo' && props.target && !formField
      ? (photoLimitForTarget(target, {}) ?? undefined)
      : undefined;
  const max = props.max ?? defaultMax;
  const accept = props.accept ?? (kind === 'photo' ? PHOTO_EXTENSIONS.join(',') : DOCUMENT_ACCEPT);
  const uploadFile = props.uploadFile ?? defaultUploadFile;

  const [items, setItems] = useState<FileUploaderItem[]>(() =>
    (props.initialFiles ?? []).map((file) => ({
      id: `existing-${file.id}`,
      file: new File([], file.name),
      name: file.name,
      sizeBytes: file.sizeBytes ?? 0,
      status: 'done' as const,
      progress: 100,
      previewUrl: file.previewUrl,
      isCover: file.isCover ?? false,
      document: { id: file.id, name: file.name },
    })),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [limitError, setLimitError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const formInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<FileUploaderItem[]>(items);
  itemsRef.current = items;
  const callbacksRef = useRef(props);
  callbacksRef.current = props;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    const input = formInputRef.current;
    if (!formField || !input || typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    for (const item of items) if (item.status !== 'error') transfer.items.add(item.file);
    input.files = transfer.files;
  }, [items, formField]);

  const counted = items.filter((item) => item.status !== 'error').length;
  const used = existing + counted;

  function updateItem(id: string, patch: Partial<FileUploaderItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function startUpload(item: FileUploaderItem) {
    updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });
    try {
      const document = await uploadFile(item.file, {
        target,
        kind,
        documentKind: props.documentKind,
        onProgress: (percent) => updateItem(item.id, { progress: percent }),
      });
      const done: FileUploaderItem = { ...item, status: 'done', progress: 100, document };
      updateItem(item.id, { status: 'done', progress: 100, document });
      setAnnouncement(`${item.name} uploaded.`);
      callbacksRef.current.onUploaded?.(document, done);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The file could not be uploaded.';
      updateItem(item.id, { status: 'error', error: message });
      setAnnouncement(`${item.name} failed to upload. ${message}`);
    }
  }

  function validate(file: File): string | null {
    if (!matchesAccept(file, accept))
      return `File type "${extensionOf(file.name) || file.type || 'unknown'}" is not allowed`;
    if (
      kind === 'photo' &&
      !PHOTO_EXTENSIONS.includes(extensionOf(file.name)) &&
      !file.type.startsWith('image/')
    )
      return `"${file.name}" is not a photo. Choose a JPG, PNG or HEIC image.`;
    try {
      validateUploadMeta({ fileName: file.name, mimeType: file.type, sizeBytes: file.size });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'This file cannot be uploaded.';
    }
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setLimitError('');
    if (!multiple) {
      files.splice(1);
      for (const item of itemsRef.current) {
        if (item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      }
      itemsRef.current = [];
    }
    let available = kind === 'photo' && max !== undefined ? Math.max(0, max - used) : files.length;
    let blocked = 0;
    const accepted: FileUploaderItem[] = [];
    const rejected: FileUploaderItem[] = [];
    for (const file of files) {
      const id = `upload-${++itemSequence}`;
      const error = validate(file);
      if (error) {
        rejected.push({
          id,
          file,
          name: file.name,
          sizeBytes: file.size,
          status: 'error',
          progress: 0,
          error,
          isCover: false,
        });
        continue;
      }
      if (kind === 'photo' && available <= 0) {
        blocked += 1;
        continue;
      }
      available -= 1;
      const isImage = file.type.startsWith('image/');
      accepted.push({
        id,
        file,
        name: file.name,
        sizeBytes: file.size,
        status: formField ? 'done' : 'queued',
        progress: formField ? 100 : 0,
        previewUrl:
          isImage && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : undefined,
        isCover: false,
      });
    }
    if (blocked > 0 && max !== undefined) {
      const message = `Photo limit reached: you can have ${used + accepted.length} of ${max} photos. ${blocked} file${blocked === 1 ? ' was' : 's were'} not added.`;
      setLimitError(message);
      setAnnouncement(message);
    } else if (rejected.length) {
      setAnnouncement(rejected.map((item) => item.error).join(' '));
    } else {
      setAnnouncement(`${accepted.length} file${accepted.length === 1 ? '' : 's'} selected.`);
    }
    const next = [...itemsRef.current, ...rejected, ...accepted];
    itemsRef.current = next;
    setItems(next);
    if (!formField) for (const item of accepted) void startUpload(item);
  }

  async function removeItem(item: FileUploaderItem) {
    if (item.document?.id && callbacksRef.current.onRemove) {
      try {
        await callbacksRef.current.onRemove(item);
      } catch (error) {
        setLimitError(error instanceof Error ? error.message : 'The file could not be removed.');
        return;
      }
    }
    if (item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
    const next = itemsRef.current.filter((entry) => entry.id !== item.id);
    itemsRef.current = next;
    setItems(next);
    setAnnouncement(`${item.name} removed.`);
    if (item.isCover) callbacksRef.current.onCoverChange?.(null);
  }

  function moveItem(item: FileUploaderItem, direction: -1 | 1) {
    const current = [...itemsRef.current];
    const index = current.findIndex((entry) => entry.id === item.id);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= current.length) return;
    [current[index], current[swap]] = [current[swap], current[index]];
    // The cover always sorts first, matching how the saved order is read back.
    const ordered = [...current.filter((e) => e.isCover), ...current.filter((e) => !e.isCover)];
    itemsRef.current = ordered;
    setItems(ordered);
    callbacksRef.current.onOrderChange?.(ordered);
    setAnnouncement(`${item.name} moved ${direction < 0 ? 'earlier' : 'later'}.`);
  }

  function setAsCover(item: FileUploaderItem) {
    const marked = itemsRef.current.map((entry) => ({ ...entry, isCover: entry.id === item.id }));
    const next = [...marked.filter((e) => e.isCover), ...marked.filter((e) => !e.isCover)];
    itemsRef.current = next;
    setItems(next);
    const cover = next.find((entry) => entry.id === item.id) ?? null;
    callbacksRef.current.onCoverChange?.(cover);
    setAnnouncement(`${item.name} set as cover.`);
  }

  return (
    <section className={styles.uploader} aria-label={props.label ?? 'File uploader'}>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        role="group"
        aria-label={props.label ? `${props.label}: drop files here` : 'Drop files here'}
      >
        <p className={styles.dropTitle}>Drag and drop files here or browse</p>
        <p className={styles.dropHint}>
          {kind === 'photo' ? 'JPG, PNG or HEIC photos' : 'PDF, JPG, PNG, HEIC or Word'} · up to{' '}
          {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB each
        </p>
        <button
          type="button"
          className={styles.browseButton}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          className={styles.input}
          type="file"
          multiple={multiple}
          accept={accept}
          aria-label={multiple ? 'Choose files' : 'Choose a file'}
          onChange={(event) => {
            if (event.currentTarget.files) addFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />
        {formField ? (
          <input
            ref={formInputRef}
            type="file"
            name={formField}
            multiple={multiple}
            hidden
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : null}
      </div>

      {kind === 'photo' && max !== undefined && props.showCounter !== false ? (
        <p className={styles.counter} aria-label={`${used} of ${max} photos`}>
          {used} of {max} photos
        </p>
      ) : null}

      <div className={styles.status} role="status" aria-live="polite">
        {announcement}
      </div>
      {limitError ? (
        <p className={styles.error} role="alert">
          {limitError}
        </p>
      ) : null}

      {items.length ? (
        <ul className={styles.list}>
          {items.map((item, index) => (
            <li key={item.id} className={styles.item}>
              <ItemThumbnail item={item} />
              <div className={styles.details}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.meta}>
                  {item.status === 'done'
                    ? formField
                      ? 'Ready to submit'
                      : 'Uploaded'
                    : item.status === 'uploading'
                      ? `Uploading ${item.progress}%`
                      : item.status === 'error'
                        ? 'Failed'
                        : 'Queued'}
                  {item.isCover ? ' · Cover' : ''}
                </span>
                {item.status === 'uploading' || item.status === 'queued' ? (
                  <progress
                    className={styles.progress}
                    max={100}
                    value={item.progress}
                    aria-label={`Upload progress for ${item.name}`}
                  />
                ) : null}
                {item.error ? (
                  <span className={styles.error} role="alert">
                    {item.error}
                  </span>
                ) : null}
              </div>
              <div className={styles.actions}>
                {item.status === 'done' ? props.renderItemAction?.(item) : null}
                {item.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const validationError = validate(item.file);
                      if (validationError) updateItem(item.id, { error: validationError });
                      else void startUpload(item);
                    }}
                    aria-label={`Retry ${item.name}`}
                  >
                    Retry
                  </button>
                ) : null}
                {kind === 'photo' && item.status !== 'error' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => moveItem(item, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${item.name} earlier`}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(item, 1)}
                      disabled={index === items.length - 1}
                      aria-label={`Move ${item.name} later`}
                    >
                      Move down
                    </button>
                    {item.isCover ? (
                      <span className={styles.coverBadge}>Cover</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAsCover(item)}
                        aria-label={`Set ${item.name} as cover`}
                      >
                        Set as cover
                      </button>
                    )}
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => void removeItem(item)}
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default FileUploader;
