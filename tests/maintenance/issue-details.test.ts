import { beforeEach, describe, expect, it, vi } from 'vitest';
const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ db: { maintenanceRequest: { updateMany } } }));
vi.mock('@/lib/notifications/service', () => ({ publishRepairStatusEvent: vi.fn() }));
import { editRequestDetails } from '@/lib/maintenance/service';
import { maintenanceReturn, maintenanceFormHref } from '@/lib/maintenance/navigation';
import type { AuthSession } from '@/lib/auth/session';
const session = { organizationId: 'org', role: 'MANAGER' } as AuthSession;
beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});
describe('issue details editing', () => {
  it('updates only issue fields with organization/property/unit isolation', async () => {
    await editRequestDetails(
      session,
      'r',
      { title: ' Leak ', description: ' Details ', priority: 'HIGH' },
      { propertyId: 'p', unitId: 'u' },
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'r', organizationId: 'org', propertyId: 'p', unitId: 'u' },
      data: { title: 'Leak', description: 'Details', priority: 'HIGH' },
    });
  });
  it('rejects an unavailable or foreign request', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(editRequestDetails(session, 'foreign', { title: 'Leak' })).rejects.toThrow(
      'scope',
    );
  });
  it('rejects tenants and invalid values before writing', async () => {
    await expect(
      editRequestDetails({ ...session, role: 'TENANT' }, 'r', { title: 'Leak' }),
    ).rejects.toThrow('Manager');
    await expect(editRequestDetails(session, 'r', { title: '   ' })).rejects.toThrow('Title');
    await expect(
      editRequestDetails(session, 'r', { title: 'Leak', description: 'x'.repeat(3001) }),
    ).rejects.toThrow('Description');
    await expect(
      editRequestDetails(session, 'r', { title: 'Leak', priority: 'INVALID' as never }),
    ).rejects.toThrow('priority');
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('allows only maintenance return paths and encodes context', () => {
    for (const url of [
      'https://example.com',
      '//evil',
      '/maintenance-evil',
      '/properties/p',
      '/maintenance\\evil',
    ])
      expect(maintenanceReturn(url)).toBe('/maintenance');
    expect(maintenanceReturn('/properties/p/maintenance?unit=u')).toBe(
      '/properties/p/maintenance?unit=u',
    );
    expect(maintenanceFormHref('p', 'u', '/properties/p/maintenance?unit=u', 'r')).toContain(
      '/maintenance/r/edit?',
    );
  });
});
