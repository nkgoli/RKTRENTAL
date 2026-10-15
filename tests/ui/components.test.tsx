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
import { nextTrapIndex } from '@/components/shell/drawer';
import {
  Alert,
  AvatarStack,
  Badge,
  Button,
  Cover,
  KpiIcon,
  OccupancyRing,
  Progress,
  Sparkline,
  Stat,
  Steps,
  Switch,
  TrendChip,
} from '@/components/ui';

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

  it('has the grouped manager nav and four tenant tabs', () => {
    expect(managerNav.map((g) => g.label)).toEqual([
      'Overview',
      'Portfolio',
      'Leasing',
      'Money',
      'Operations',
      'Settings',
    ]);
    expect(managerNav.find((g) => g.pinned)?.items.map((i) => i.label)).toEqual(['Integrations']);
    expect(tenantTabs.map((t) => t.label)).toEqual(['Home', 'Pay', 'Lease', 'Repairs']);
  });

  it('ManagerShell marks only the current route active and sets the topbar', () => {
    pathname.value = '/payments';
    const out = html(<ManagerShell>body</ManagerShell>);
    expect(out.match(/class="active"/g)).toHaveLength(1);
    expect(out).toMatch(
      /<a[^>]*class="active"[^>]*aria-current="page"[^>]*>(?:<svg.*?<\/svg>)Payments/,
    );
    expect(out).toContain('<p class="eyebrow">Money</p><h1>Payments</h1>');
    expect(out).toContain('Jordan Mills');
  });

  it('ManagerShell groups the sidebar, hides Rent comps and starts with the drawer closed', () => {
    pathname.value = '/dashboard';
    const out = html(<ManagerShell>body</ManagerShell>);
    const labels = [...out.matchAll(/class="nav-label">([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(['Portfolio', 'Leasing', 'Money', 'Operations']);
    expect(out).not.toContain('Rent comps');
    expect(out).toContain('nav-section nav-pinned');
    expect(out).not.toContain('drawer-open');
    expect(out).not.toContain('class="scrim"');
    expect(out).toContain('aria-label="Open menu"');
    expect(out).toContain('aria-expanded="false"');
    pathname.value = '/rent-comps';
    expect(html(<ManagerShell>body</ManagerShell>)).toContain('<h1>Rent comps</h1>');
  });

  it('wraps focus in both directions', () => {
    expect(nextTrapIndex(3, 2, false)).toBe(0);
    expect(nextTrapIndex(3, 0, true)).toBe(2);
    expect(nextTrapIndex(3, 1, false)).toBe(2);
    expect(nextTrapIndex(3, -1, false)).toBe(0);
    expect(nextTrapIndex(3, -1, true)).toBe(2);
    expect(nextTrapIndex(0, 0, false)).toBe(-1);
  });

  it('TenantShell marks the current tab active', () => {
    pathname.value = '/repairs';
    const out = html(<TenantShell>body</TenantShell>);
    expect(out.match(/class="active"/g)).toHaveLength(1);
    expect(out).toMatch(/class="active"[^>]*>Repairs</);
  });
});

describe('flair components', () => {
  it('KpiIcon and TrendChip map tone to class', () => {
    expect(html(<KpiIcon tone="coral">x</KpiIcon>)).toContain('class="kpi-icon coral"');
    expect(html(<KpiIcon>x</KpiIcon>)).toContain('kpi-icon blue');
    expect(html(<TrendChip>+4%</TrendChip>)).toContain('class="trend"');
    expect(html(<TrendChip warm>-2%</TrendChip>)).toContain('trend warm');
  });

  it('Sparkline draws an area and line scaled to its viewBox', () => {
    const out = html(<Sparkline values={[1, 3, 2, 5]} tone="ok" label="Rent trend" />);
    expect(out).toContain('class="spark ok"');
    expect(out).toContain('aria-label="Rent trend"');
    expect(out).toContain('<polygon');
    expect(out).toContain('<polyline points="0,31 32,17 64,24 96,3"');
    expect(out).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(html(<Sparkline values={[4]} />)).toContain('aria-hidden="true"');
  });

  it('OccupancyRing clamps the value and uses currentColor classes', () => {
    const out = html(<OccupancyRing value={50} />);
    expect(out).toContain('class="ring"');
    expect(out).toContain('50% occupied');
    expect(out).toContain('ring-fill');
    expect(out).toContain('stroke-dasharray="62.83 125.66"');
    expect(html(<OccupancyRing value={140} warm />)).toContain('ring warm');
    expect(html(<OccupancyRing value={140} />)).toContain('100%');
    expect(html(<OccupancyRing value={-5} />)).toContain('0%');
  });

  it('AvatarStack colours initials and collapses the overflow', () => {
    const out = html(<AvatarStack initials={['AR', 'JM', 'LK', 'OR', 'PT', 'QZ']} max={4} />);
    expect(out).toContain('av c1');
    expect(out).toContain('av c4');
    expect(out).toContain('av more">+2<');
    expect(html(<AvatarStack initials={['AR']} />)).not.toContain('more');
  });

  it('Cover renders each illustration and an optional image', () => {
    for (const kind of ['apartment', 'lofts', 'townhomes', 'house'] as const) {
      expect(html(<Cover kind={kind} />)).toContain('cover cover--' + kind);
    }
    const photo = html(<Cover kind="house" src="/p/1.jpg" />);
    expect(photo).toContain('has-img');
    expect(photo).toContain('background-image:url(&quot;/p/1.jpg&quot;)');
    expect(html(<Cover />)).not.toContain('has-img');
  });
});