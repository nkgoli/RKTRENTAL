import { describe, expect, it } from 'vitest';
import type { MaintenanceEditorData } from '@/lib/maintenance/editor';
import {
  activityEntries,
  photoLine,
  requestMeta,
  statusStep,
} from '@/components/maintenance/editor-view';

const record = {
  title: 'Kitchen sink leak',
  property: { id: 'p', name: 'Maple Court' },
  unit: { id: 'u', number: '4B' },
  createdAt: '2026-10-20T18:57:00.000Z',
} as MaintenanceEditorData;
const event = (
  values: Partial<MaintenanceEditorData['events'][number]>,
): MaintenanceEditorData['events'][number] => ({
  id: 'e',
  kind: 'CREATED',
  body: null,
  fromStatus: null,
  toStatus: null,
  createdAt: '2026-10-20T18:57:00.000Z',
  actor: null,
  ...values,
});
const photo = (name: string, createdAt: string) => ({
  documentId: name,
  createdAt,
  document: { name },
});

describe('maintenance editor view helpers', () => {
  it('maps saved status onto the board steps', () => {
    expect(statusStep('NEW')).toBe(0);
    expect(statusStep('IN_PROGRESS')).toBe(2);
    expect(statusStep('DONE')).toBe(3);
    expect(statusStep('CANCELLED')).toBe(-1);
  });

  it('builds the header meta line from the saved request', () => {
    expect(requestMeta(record)).toBe(
      'Kitchen sink leak · Maple Court · Unit 4B · opened Oct 20, 2026',
    );
  });

  it('describes attached photos', () => {
    expect(photoLine([])).toBe('Photos · none added');
    expect(photoLine([photo('sink.png', '2026-10-20T19:00:00.000Z')])).toBe('sink.png · 1 photo');
    expect(
      photoLine([
        photo('sink.png', '2026-10-20T19:00:00.000Z'),
        photo('pipe.png', '2026-10-20T19:01:00.000Z'),
      ]),
    ).toBe('sink.png and 1 more · 2 photos');
  });

  it('lists real events newest first with photos summarised as one entry', () => {
    const entries = activityEntries({
      events: [
        event({
          id: 'c',
          kind: 'COMMENT',
          body: 'Visit at 2 PM',
          actor: { name: 'Pat Manager' },
          createdAt: '2026-10-21T09:00:00.000Z',
        }),
        event({
          id: 's',
          kind: 'STATUS_CHANGED',
          fromStatus: 'NEW',
          toStatus: 'ASSIGNED',
          createdAt: '2026-10-20T20:00:00.000Z',
        }),
        event({ id: 'o', kind: 'CREATED' }),
      ],
      photos: [photo('sink.png', '2026-10-20T19:00:00.000Z')],
    });
    expect(entries.map((entry) => entry.title)).toEqual([
      'Pat Manager',
      'New → Assigned',
      '1 photo attached',
      'Request opened',
    ]);
    expect(entries[0]).toMatchObject({ comment: true, body: 'Visit at 2 PM' });
    expect(entries[2].author).toBe('sink.png');
  });
});
