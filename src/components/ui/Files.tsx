import type { ReactNode } from 'react';
import { cx } from './cx';

export function UploadDropZone({ children }: { children?: ReactNode }) {
  return (
    <div className="upload">
      {children ?? (
        <>
          <strong>Click to upload</strong> or drag and drop
        </>
      )}
    </div>
  );
}

export function FileRow({
  kind = 'doc',
  name,
  meta,
  action,
}: {
  kind?: 'pdf' | 'img' | 'doc';
  name: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="file">
      <span className={cx('file-icon', kind !== 'doc' && kind)}>{kind.toUpperCase()}</span>
      <div className="file-meta">
        <strong>{name}</strong>
        {meta && <small>{meta}</small>}
      </div>
      {action}
    </div>
  );
}

export function PhotoTile({
  caption,
  shade,
  wide,
}: {
  caption?: string;
  shade?: 'a' | 'b' | 'c' | 'd';
  wide?: boolean;
}) {
  return (
    <div className={cx('photo', shade && shade !== 'a' && shade, wide && 'wide')}>
      {caption && <span className="caption">{caption}</span>}
    </div>
  );
}

export function Gallery({ children }: { children: ReactNode }) {
  return <div className="gallery">{children}</div>;
}
