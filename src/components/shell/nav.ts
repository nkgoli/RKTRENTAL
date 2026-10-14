export type IconName =
  | 'dashboard'
  | 'properties'
  | 'tenants'
  | 'leases'
  | 'applications'
  | 'payments'
  | 'returns'
  | 'rent-comps'
  | 'maintenance'
  | 'documents'
  | 'integrations';

export type ManagerAction = { label: string; href: string; primary?: boolean };

export type ManagerNavItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Topbar heading when it differs from the nav label. */
  title?: string;
  actions?: ManagerAction[];
};

export type ManagerNavGroup = { label: string; items: ManagerNavItem[] };

export const managerNav: ManagerNavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'dashboard',
        actions: [
          { label: 'Export report', href: '/returns' },
          { label: '+ Add property', href: '/properties', primary: true },
        ],
      },
    ],
  },
  {
    label: 'Portfolio',
    items: [
      {
        label: 'Properties',
        href: '/properties',
        icon: 'properties',
        actions: [{ label: '+ Add property', href: '/properties', primary: true }],
      },
      {
        label: 'Tenants',
        href: '/tenants',
        icon: 'tenants',
        actions: [{ label: '+ Add tenant', href: '/tenants', primary: true }],
      },
      {
        label: 'Leases',
        href: '/leases',
        icon: 'leases',
        actions: [{ label: '+ Create lease', href: '/leases', primary: true }],
      },
      { label: 'Applications', href: '/applications', icon: 'applications' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Payments', href: '/payments', icon: 'payments' },
      {
        label: 'Returns',
        href: '/returns',
        icon: 'returns',
        title: 'Returns and metrics',
        actions: [{ label: 'Export report', href: '/returns' }],
      },
      { label: 'Rent comps', href: '/rent-comps', icon: 'rent-comps' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Maintenance', href: '/maintenance', icon: 'maintenance' },
      { label: 'Documents', href: '/documents', icon: 'documents', title: 'Documents and photos' },
    ],
  },
  {
    label: 'Settings',
    items: [{ label: 'Integrations', href: '/integrations', icon: 'integrations' }],
  },
];

export type TenantTab = { label: string; href: string };

export const tenantTabs: TenantTab[] = [
  { label: 'Home', href: '/home' },
  { label: 'Pay', href: '/pay' },
  { label: 'Lease', href: '/lease' },
  { label: 'Repairs', href: '/repairs' },
];

/** True when `pathname` is `href` or a route nested under it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findManagerItem(
  pathname: string,
): { group: ManagerNavGroup; item: ManagerNavItem } | undefined {
  for (const group of managerNav) {
    for (const item of group.items) {
      if (isActive(pathname, item.href)) return { group, item };
    }
  }
  return undefined;
}

export function findTenantTab(pathname: string): TenantTab | undefined {
  return tenantTabs.find((t) => isActive(pathname, t.href));
}
