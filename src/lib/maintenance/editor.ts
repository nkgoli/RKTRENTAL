import type { getMaintenanceEditor } from './service';

type EditorRecord = NonNullable<Awaited<ReturnType<typeof getMaintenanceEditor>>>;

/** Explicit JSON boundary shared by the initial page and immediate-action responses. */
export function serializeMaintenanceEditor(request: EditorRecord) {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    completedAt: request.completedAt?.toISOString() ?? null,
    events: request.events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    photos: request.photos.map((photo) => ({ ...photo, createdAt: photo.createdAt.toISOString() })),
  };
}

export type MaintenanceEditorData = ReturnType<typeof serializeMaintenanceEditor>;
export type EditorValues = Pick<MaintenanceEditorData, 'title' | 'priority' | 'status'> & {
  description: string;
  vendorId: string;
};
export const editorValues = (request: MaintenanceEditorData): EditorValues => ({
  title: request.title,
  description: request.description ?? '',
  priority: request.priority,
  status: request.status,
  vendorId: request.vendorId ?? '',
});

export const statusLabels = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
} as const;
export const priorityLabels = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
} as const;

export function eventLabel(event: MaintenanceEditorData['events'][number]) {
  if (event.kind === 'CREATED') return 'Request created';
  if (event.kind === 'VENDOR_ASSIGNED')
    return `Vendor assigned${event.body ? ` · ${event.body}` : ''}`;
  if (event.kind === 'STATUS_CHANGED')
    return event.fromStatus && event.toStatus
      ? `${statusLabels[event.fromStatus]} → ${statusLabels[event.toStatus]}`
      : 'Status updated';
  if (event.kind === 'DETAILS_UPDATED') return 'Request details updated';
  if (event.kind === 'COMMENT') return 'Comment added';
  return event.kind.replaceAll('_', ' ').toLowerCase();
}
