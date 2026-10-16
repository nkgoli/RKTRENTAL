import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MaintenanceBoardRequest } from '@/lib/maintenance';
import { PropertyMaintenanceList } from '@/components/workspace/panels/operations/PropertyMaintenanceList';

const request = {
  id: 'request-1',
  organizationId: 'org-1',
  propertyId: 'property-1',
  unitId: 'unit-1',
  title: 'Kitchen sink leak',
  description: 'Water is pooling below the sink.',
  priority: 'URGENT',
  status: 'NEW',
  vendorId: null,
  vendorName: null,
  tenantId: null,
  createdAt: new Date('2026-10-12T12:00:00.000Z'),
  updatedAt: new Date('2026-10-12T12:00:00.000Z'),
  completedAt: null,
  property: { id: 'property-1', name: '18 Elm Street' },
  unit: { id: 'unit-1', number: 'Home' },
  vendor: null,
  photos: [],
  events: [],
} as unknown as MaintenanceBoardRequest;

describe('property operations panels', () => {
  it('renders a property-scoped maintenance list with status and assignee', () => {
    const html = renderToStaticMarkup(
      <PropertyMaintenanceList
        propertyId="property-1"
        requests={[request]}
        openCount={1}
        urgentCount={1}
        doneThisWeekCount={2}
        createRequestControl={<button type="button">+ New request</button>}
      />,
    );

    expect(html).toContain('>Open<');
    expect(html).toContain('>Urgent<');
    expect(html).toContain('>Done this week<');
    expect(html).toContain('Kitchen sink leak');
    expect(html).toContain('>New<');
    expect(html).toContain('>Unassigned<');
    expect(html).not.toContain('All properties');
    expect(html).not.toContain('Across ');
    expect(html).not.toContain('kanban');
  });
});
