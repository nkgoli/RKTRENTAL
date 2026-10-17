import { describe, expect, it, vi } from 'vitest';

const { findMany, count, groupBy, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn<(args: unknown) => Promise<unknown[]>>(async () => []),
  count: vi.fn<(args: unknown) => Promise<number>>(async () => 0),
  groupBy: vi.fn<(args: unknown) => Promise<unknown[]>>(async () => []),
  findFirst: vi.fn<(args: unknown) => Promise<null>>(async () => null),
}));
vi.mock('@/lib/db/client', () => ({
  db: { maintenanceRequest: { findMany, count, groupBy, findFirst } },
}));

import { listMaintenancePage } from '@/lib/maintenance/service';
import {
  maintenanceQueryString,
  parseMaintenanceQuery,
  usesRecentWindow,
} from '@/lib/maintenance/query';

describe('maintenance list query', () => {
  it('defaults to the recent window on page 1', () => {
    const query = parseMaintenanceQuery({});
    expect(query).toEqual({ allHistory: false, page: 1 });
    expect(usesRecentWindow(query)).toBe(true);
  });

  it('parses and sanitizes status, dates, history and page', () => {
    const query = parseMaintenanceQuery({
      status: 'done',
      from: '2026-01-02',
      to: 'nope',
      history: 'all',
      page: '3',
    });
    expect(query).toMatchObject({ status: 'DONE', from: '2026-01-02', allHistory: true, page: 3 });
    expect(query.to).toBeUndefined();
    expect(parseMaintenanceQuery({ status: 'bogus', page: '-4' })).toEqual({
      allHistory: false,
      page: 1,
    });
  });

  it('round-trips through the URL and keeps defaults out of it', () => {
    expect(maintenanceQueryString({ allHistory: false, page: 1 })).toBe('');
    const query = parseMaintenanceQuery({ status: 'NEW', page: '2', history: 'all' });
    const text = maintenanceQueryString(query, { propertyId: 'p1' });
    expect(parseMaintenanceQuery(Object.fromEntries(new URLSearchParams(text)))).toEqual(query);
    expect(text).toContain('propertyId=p1');
  });
});

describe('listMaintenancePage', () => {
  const now = new Date('2026-10-16T12:00:00Z');

  it('applies the open + last-90-days window by default', async () => {
    findMany.mockClear();
    await listMaintenancePage('org-1', {}, { allHistory: false, page: 1 }, now);
    const args = findMany.mock.calls[0]?.[0] as {
      where: { OR: unknown[] };
      take: number;
      skip: number;
    };
    expect(args.take).toBe(20);
    expect(args.skip).toBe(0);
    expect(JSON.stringify(args.where.OR)).toContain('2026-07-18T12:00:00.000Z');
  });

  it('drops the window for full history and pages with skip/take', async () => {
    findMany.mockClear();
    count.mockResolvedValueOnce(120);
    await listMaintenancePage('org-1', {}, { allHistory: true, page: 3 }, now);
    const args = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; skip: number };
    expect(args.where).toEqual({ organizationId: 'org-1' });
    expect(args.skip).toBe(40);
  });

  it('loads one cover photo and issues one findMany (no per-row queries)', async () => {
    findMany.mockClear();
    await listMaintenancePage('org-1', {}, { allHistory: false, page: 1 }, now);
    expect(findMany).toHaveBeenCalledTimes(1);
    const select = (findMany.mock.calls[0]?.[0] as { select: { photos: { take: number } } }).select;
    expect(select.photos.take).toBe(1);
  });
});
