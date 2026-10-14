import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

import { ManagerShell } from '@/components/shell/ManagerShell';
import { TenantShell } from '@/components/shell/TenantShell';
import {
  findManagerItem,
  findTenantTab,
  isActive,
  managerNav,
  tenantTabs,
} from '@/components/shell/nav';
import { Alert, Badge, Button, Progress, Stat, Steps, Switch } from '@/components/ui';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('ui components', () => {
  it('Button renders variant classes as a button or a link', () => {
    expect(html(<Button variant="primary">Save</Button>)).toContain('class="btn btn-primary"');
    expect(
      html(
        <Button variant="danger" size="sm">
          Delete
        </Button>,
      ),
    ).toContain('btn btn-danger btn-sm');
    const link = html(<Button href="/leases">Leases</Button>);
    expect(link).toContain('<a');
    expect(link).toContain('href="/leases"');
    expect(link).toContain('btn-secondary');
  });

  it('Badge maps tone to class', () => {
    expect(html(<Badge tone="success">Paid</Badge>)).toContain('class="badge success"');
    expect(html(<Badge>Plain</Badge>)).toContain('class="badge"');
  });

  it('Stat shows label, value, delta tone and clamped progress', () => {
    const out = html(
      <Stat label="Occupancy" value="91%" delta="4 vacant" tone="up" progress={140} />,
    );
    expect(out).toContain('Occupancy');
    expect(out).toContain('delta up');
    expect(out).toContain('width:100%');
  });

  it('Progress, Alert, Steps and Switch expose state', () => {
    expect(html(<Progress value={40} />)).toContain('aria-valuenow="40"');
    expect(html(<Alert tone="warning">Heads up</Alert>)).toContain('alert warning');
    const steps = html(<Steps steps={['A', 'B', 'C']} current={1} />);
    expect(steps).toContain('class="done"');
    expect(steps).toContain('class="current"');
    expect(html(<Switch on label="Autopay" />)).toContain('aria-checked="true"');
  });
});

describe('navigation', () => {
  it('matches nested routes to their nav item', () => {
    expect(isActive('/properties/42', '/properties')).toBe(true);
    expect(isActive('/properties-old', '/properties')).toBe(false);
    expect(findManagerItem('/leases/new')?.item.label).toBe('Leases');
    expect(findTenantTab('/pay')?.label).toBe('Pay');
  });

  it('has the five manager groups and four tenant tabs', () => {
    expect(managerNav.map((g) => g.label)).toEqual([
      'Overview',
      'Portfolio',
      'Finance',
      'Operations',
      'Settings',
    ]);
    expect(tenantTabs.map((t) => t.label)).toEqual(['Home', 'Pay', 'Lease', 'Repairs']);
  });

  it('ManagerShell marks only the current route active and sets the topbar', () => {
    pathname.value = '/payments';
    const out = html(<ManagerShell>body</ManagerShell>);
    expect(out.match(/class="active"/g)).toHaveLength(1);
    expect(out).toMatch(
      /<a[^>]*class="active"[^>]*aria-current="page"[^>]*>(?:<svg.*?<\/svg>)Payments/,
    );
    expect(out).toContain('<p class="eyebrow">Finance</p><h1>Payments</h1>');
    expect(out).toContain('Jordan Mills');
  });

  it('TenantShell marks the current tab active', () => {
    pathname.value = '/repairs';
    const out = html(<TenantShell>body</TenantShell>);
    expect(out.match(/class="active"/g)).toHaveLength(1);
    expect(out).toMatch(/class="active"[^>]*>Repairs</);
  });
});
