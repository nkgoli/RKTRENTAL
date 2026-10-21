import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import type { AuthSession } from '@/lib/auth/session';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  request: vi.fn(),
  update: vi.fn(),
  vendor: vi.fn(),
  event: vi.fn(),
  publish: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/notifications/service', () => ({
  publishRepairStatusEvent: mocks.publish,
}));
import { saveMaintenanceEditor } from '@/lib/maintenance/service';

const session = {
  organizationId: 'org',
  subjectId: 'manager',
  role: 'MANAGER',
} as AuthSession;
const scope = { propertyId: 'property', unitId: 'unit' };
const timestamp = '2026-10-21T12:00:00.000Z';
const tx = {
  maintenanceRequest: { findFirst: mocks.request, updateMany: mocks.update },
  vendor: { findFirst: mocks.vendor },
  maintenanceEvent: { create: mocks.event },
};
const request = () => ({
  id: 'request',
  organizationId: 'org',
  ...scope,
  tenantId: null,
  title: 'Kitchen sink leak',
  description: 'Water beneath the sink.',
  priority: 'NORMAL' as MaintenancePriority,
  status: 'NEW' as MaintenanceStatus,
  vendorId: null as string | null,
  vendorName: null as string | null,
  createdAt: new Date('2026-10-20T12:00:00.000Z'),
  updatedAt: new Date(timestamp),
  completedAt: null as Date | null,
});
const input = () => ({
  title: 'Kitchen sink leak',
  description: 'Water beneath the sink.',
  priority: 'NORMAL' as MaintenancePriority,
  vendorId: null as string | null,
  status: 'NEW' as MaintenanceStatus,
  updatedAt: timestamp,
});
const save = (values: Partial<ReturnType<typeof input>> = {}) =>
  saveMaintenanceEditor(session, 'request', { ...input(), ...values }, scope);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
    callback(tx),
  );
  mocks.request.mockResolvedValue(request());
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.vendor.mockResolvedValue({ id: 'vendor', organizationId: 'org', name: 'Harbor Plumbing' });
  mocks.event.mockImplementation(async ({ data }) => ({ id: `event-${data.kind}`, ...data }));
  mocks.publish.mockResolvedValue(1);
});
afterEach(() => vi.restoreAllMocks());

describe('atomic maintenance editor save', () => {
  it('rejects tenant access before starting a write transaction', async () => {
    await expect(
      saveMaintenanceEditor({ ...session, role: 'TENANT' }, 'request', input(), scope),
    ).rejects.toThrow(/manager/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('requires the request to belong to the organization, property and unit', async () => {
    mocks.request.mockResolvedValue(null);
    await expect(save()).rejects.toThrow();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'request', organizationId: 'org', ...scope }),
      }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it.each([
    { title: '   ' },
    { title: 'x'.repeat(161) },
    { description: 'x'.repeat(3001) },
    { priority: 'INVALID' as MaintenancePriority },
    { status: 'INVALID' as MaintenanceStatus },
    { updatedAt: 'not-a-date' },
  ])('rejects invalid editor fields before writing: %j', async (invalid) => {
    await expect(save(invalid)).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('rejects a missing or foreign vendor before changing details', async () => {
    mocks.vendor.mockResolvedValue(null);
    await expect(save({ title: 'Changed title', vendorId: 'foreign-vendor' })).rejects.toThrow(
      /vendor/i,
    );
    expect(mocks.vendor).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'foreign-vendor', organizationId: 'org' }),
      }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it('does not silently remove an existing vendor assignment', async () => {
    mocks.request.mockResolvedValue({
      ...request(),
      vendorId: 'vendor',
      vendorName: 'Harbor Plumbing',
      status: 'ASSIGNED',
    });
    await expect(save({ status: 'ASSIGNED', vendorId: null })).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it('saves scoped details and assignment together, promoting a new request once', async () => {
    await save({
      title: '  Sink needs repair  ',
      description: '  Updated details  ',
      vendorId: 'vendor',
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'request',
        organizationId: 'org',
        ...scope,
        updatedAt: new Date(timestamp),
      }),
      data: expect.objectContaining({
        title: 'Sink needs repair',
        description: 'Updated details',
        priority: 'NORMAL',
        vendorId: 'vendor',
        vendorName: 'Harbor Plumbing',
        status: 'ASSIGNED',
      }),
    });
    expect(mocks.event.mock.calls.map(([value]) => value.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'DETAILS_UPDATED' }),
        expect.objectContaining({
          organizationId: 'org',
          maintenanceRequestId: 'request',
          actorId: 'manager',
          kind: 'VENDOR_ASSIGNED',
          body: 'Harbor Plumbing',
        }),
        expect.objectContaining({
          kind: 'STATUS_CHANGED',
          fromStatus: 'NEW',
          toStatus: 'ASSIGNED',
        }),
      ]),
    );
    expect(mocks.event).toHaveBeenCalledTimes(3);
    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith('org', 'event-STATUS_CHANGED');
  });

  it('records changed details without reassigning an existing vendor or notifying status', async () => {
    mocks.request.mockResolvedValue({
      ...request(),
      vendorId: 'vendor',
      vendorName: 'Harbor Plumbing',
      status: 'ASSIGNED',
    });
    await save({ title: 'Updated sink repair', vendorId: 'vendor', status: 'ASSIGNED' });
    expect(mocks.vendor).not.toHaveBeenCalled();
    expect(mocks.event).toHaveBeenCalledExactlyOnceWith({
      data: {
        organizationId: 'org',
        maintenanceRequestId: 'request',
        actorId: 'manager',
        kind: 'DETAILS_UPDATED',
      },
    });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('records only the final explicit status when assigning and starting work together', async () => {
    await save({ vendorId: 'vendor', status: 'IN_PROGRESS' });
    const statusEvents = mocks.event.mock.calls
      .map(([value]) => value.data)
      .filter((event) => event.kind === 'STATUS_CHANGED');
    expect(statusEvents).toEqual([
      expect.objectContaining({ fromStatus: 'NEW', toStatus: 'IN_PROGRESS' }),
    ]);
    expect(mocks.update.mock.calls[0][0].data.status).toBe('IN_PROGRESS');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('sets the completion date when completing and clears it when reopening', async () => {
    await save({ status: 'DONE' });
    expect(mocks.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
    mocks.request.mockResolvedValue({
      ...request(),
      status: 'DONE',
      completedAt: new Date(timestamp),
    });
    await save({ status: 'IN_PROGRESS' });
    expect(mocks.update.mock.calls[1][0].data.completedAt).toBeNull();
    expect(mocks.event.mock.calls[1][0].data).toEqual(
      expect.objectContaining({
        kind: 'STATUS_CHANGED',
        fromStatus: 'DONE',
        toStatus: 'IN_PROGRESS',
      }),
    );
  });

  it('preserves completion history and produces no events for identical saves', async () => {
    mocks.request.mockResolvedValue({
      ...request(),
      status: 'DONE',
      completedAt: new Date(timestamp),
    });
    await save({ status: 'DONE' });
    await save({ status: 'DONE' });
    for (const [args] of mocks.update.mock.calls) {
      if ('completedAt' in args.data) expect(args.data.completedAt).toEqual(new Date(timestamp));
    }
    expect(mocks.event).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('rejects a concurrent write without creating events or sending notifications', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    await expect(save({ title: 'Changed title', vendorId: 'vendor' })).rejects.toThrow();
    expect(mocks.event).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('does not duplicate events when a stale submission is retried', async () => {
    await save({ vendorId: 'vendor', status: 'IN_PROGRESS' });
    mocks.request.mockResolvedValue({
      ...request(),
      vendorId: 'vendor',
      vendorName: 'Harbor Plumbing',
      status: 'IN_PROGRESS',
      updatedAt: new Date('2026-10-21T12:01:00.000Z'),
    });
    mocks.update.mockResolvedValue({ count: 0 });
    await save({ vendorId: 'vendor', status: 'IN_PROGRESS' }).catch(() => undefined);
    expect(mocks.event).toHaveBeenCalledTimes(2);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects the transaction when an event write fails without publishing', async () => {
    mocks.event.mockRejectedValue(new Error('event write failed'));
    await expect(save({ vendorId: 'vendor' })).rejects.toThrow('event write failed');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('publishes only after commit and still succeeds when email delivery is deferred', async () => {
    let committed = false;
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      const result = await callback(tx);
      committed = true;
      return result;
    });
    mocks.publish.mockImplementation(async () => {
      expect(committed).toBe(true);
      throw new Error('email unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await save({ status: 'IN_PROGRESS' });
    expect(mocks.event).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });
});
