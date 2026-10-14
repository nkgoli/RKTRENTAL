import { FileRow } from '@/components/ui';
import { formatBytes, formatDate } from '@/lib/properties/format';

type FileItem = { id: string; name: string; mimeType: string; sizeBytes: number; createdAt: Date };

const shades = ['', 'b', 'c', 'd'] as const;

export const previewUrl = (id: string) => `/api/files/${id}/preview`;
export const downloadUrl = (id: string) => `/api/files/${id}/download`;

/** A photo tile. HEIC can't render in most browsers, so it falls back to the caption. */
export function PhotoImage({
  photo,
  index = 0,
  wide,
  style,
}: {
  photo: FileItem;
  index?: number;
  wide?: boolean;
  style?: React.CSSProperties;
}) {
  const shade = shades[index % shades.length];
  return (
    <div className={['photo', shade, wide ? 'wide' : ''].filter(Boolean).join(' ')} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl(photo.id)}
        alt={photo.name}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <span className="caption">{photo.name}</span>
    </div>
  );
}

export function fileKind(mime: string): 'pdf' | 'img' | 'doc' {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'img';
  return 'doc';
}

export function FileList({ files, empty }: { files: FileItem[]; empty: string }) {
  if (!files.length) {
    return (
      <p className="muted" style={{ fontSize: 13, padding: '4px 0' }}>
        {empty}
      </p>
    );
  }
  return (
    <>
      {files.map((f) => (
        <FileRow
          key={f.id}
          kind={fileKind(f.mimeType)}
          name={f.name}
          meta={`Uploaded ${formatDate(f.createdAt)} · ${formatBytes(f.sizeBytes)}`}
          action={
            <a className="btn btn-sm btn-secondary" href={downloadUrl(f.id)}>
              Download
            </a>
          }
        />
      ))}
    </>
  );
}
