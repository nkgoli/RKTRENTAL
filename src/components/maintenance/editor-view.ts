import type { BadgeTone } from '@/components/ui/Badge';
import { eventLabel, type MaintenanceEditorData } from '@/lib/maintenance/editor';

type Status = MaintenanceEditorData['status'];
type Priority = MaintenanceEditorData['priority'];

/** Board stages in order; Cancelled requests sit outside the steps. */
export const STATUS_STEPS = ['New', 'Assigned', 'In progress', 'Done'];
const STEP_INDEX: Record<Status, number> = {
  NEW: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  DONE: 3,
  CANCELLED: -1,
};

export function statusStep(status: Status) {
  return STEP_INDEX[status];
}

export const statusTones: Record<Status, BadgeTone> = {
  NEW: 'info',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  CANCELLED: 'neutral',
};

export const priorityTones: Record<Priority, BadgeTone> = {
  LOW: 'neutral',
  NORMAL: 'neutral',
  HIGH: 'warning',
  URGENT: 'danger',
};

/** "Oct 20, 2026" in UTC, matching the editor's other timestamps. */
export function openedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

/** "Kitchen sink leak · Maple Court · Unit 4B · opened Oct 20, 2026" */
export function requestMeta(
  record: Pick<MaintenanceEditorData, 'title' | 'property' | 'unit' | 'createdAt'>,
) {
  return `${record.title} · ${record.property.name} · Unit ${record.unit.number} · opened ${openedDate(record.createdAt)}`;
}

/** "seed-photo.png · 1 photo" or "Photos · none added". */
export function photoLine(photos: MaintenanceEditorData['photos']) {
  if (!photos.length) return 'Photos · none added';
  const count = `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`;
  const first = photos[0].document?.name;
  if (!first) return count;
  return photos.length === 1
    ? `${first} · ${count}`
    : `${first} and ${photos.length - 1} more · ${count}`;
}

export type ActivityEntry = {
  id: string;
  title: string;
  createdAt: string;
  comment: boolean;
  author?: string;
  body?: string | null;
};

/** Request events newest first, with stored photos summarised as one "attached" entry. */
export function activityEntries(record: Pick<MaintenanceEditorData, 'events' | 'photos'>) {
  const entries: ActivityEntry[] = record.events.map((event) => {
    const comment = event.kind === 'COMMENT';
    return {
      id: event.id,
      title:
        comment && event.actor?.name
          ? event.actor.name
          : event.kind === 'CREATED'
            ? 'Request opened'
            : eventLabel(event),
      createdAt: event.createdAt,
      comment,
      author: !comment ? (event.actor?.name ?? undefined) : undefined,
      body: comment ? event.body : undefined,
    };
  });
  if (record.photos.length) {
    const latest = record.photos.reduce((last, photo) =>
      photo.createdAt > last.createdAt ? photo : last,
    );
    const names = record.photos
      .map((photo) => photo.document?.name)
      .filter(Boolean)
      .join(', ');
    entries.push({
      id: 'photos',
      title: `${record.photos.length} ${record.photos.length === 1 ? 'photo' : 'photos'} attached`,
      createdAt: latest.createdAt,
      comment: false,
      author: names || undefined,
    });
  }
  return entries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
