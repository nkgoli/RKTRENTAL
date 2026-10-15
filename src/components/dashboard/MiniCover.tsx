import { Cover, type CoverKind } from '@/components/ui';
import styles from './hero.module.css';

export type CoverSource = {
  type: 'SINGLE_UNIT' | 'MULTI_UNIT';
  unitCount: number;
  coverPhotoId: string | null;
};

export function coverKindFor(property: Pick<CoverSource, 'type' | 'unitCount'>): CoverKind {
  if (property.type === 'SINGLE_UNIT') return 'house';
  return property.unitCount >= 6 ? 'apartment' : 'townhomes';
}

export function coverSrcFor(property: Pick<CoverSource, 'coverPhotoId'>) {
  return property.coverPhotoId ? `/api/files/${property.coverPhotoId}/preview` : undefined;
}

/** Small property cover for tables and compact lists. */
export function MiniCover({ cover }: { cover?: CoverSource }) {
  return (
    <span className={styles.mini} aria-hidden="true">
      <Cover kind={cover ? coverKindFor(cover) : 'apartment'} src={cover ? coverSrcFor(cover) : undefined} />
    </span>
  );
}
