export type IconName =
  | 'dashboard'
  | 'properties'
  | 'tenants'
  | 'leases'
  | 'applications'
  | 'payments'
  | 'returns'
  | 'roi-analysis'
  | 'rent-analysis'
  | 'rent-comps'
  | 'maintenance'
  | 'documents'
  | 'integrations';

export type ManagerAction = {
  label: string;
  href: string;
  primary?: boolean;
  /** Stroked icon before the label; use `plus` for create actions instead of a typed "+". */
  icon?: 'plus' | 'arrow-right' | 'arrow-left' | 'download';
};

export type ManagerNavItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Topbar heading when it differs from the nav label. */
  title?: string;
  actions?: ManagerAction[];
  /** Route stays reachable and titled, but has no sidebar link. */
  hidden?: boolean;
  /** Other routes that belong to this sidebar entry and mark it current. */
  activeFor?: string[];
};

export type ManagerNavGroup = {
  label: string;
  items: ManagerNavItem[];
  /** Sidebar heading is omitted (the label still feeds the page eyebrow). */
  hideLabel?: boolean;
  /** Rendered at the bottom of the sidebar, below the other groups. */
  pinned?: boolean;
};

export const managerNav: ManagerNavGroup[] = [
  {
    label: 'Overview',
    hideLabel: true,
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'dashboard',
        actions: [
          { label: 'View reports', href: '/returns' },
          { label: 'Add property', href: '/properties?add=1', primary: true, icon: 'plus' },
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
        actions: [
          { label: 'Add property', href: '/properties?add=1', primary: true, icon: 'plus' },
        ],
      },
      {
        label: 'Tenants',
        href: '/tenants',
        icon: 'tenants',
        // Tenants are created from approved applicants, so the shortcut leads to Applications.
        actions: [
          {
            label: 'Review applications',
            href: '/applications',
            primary: true,
            icon: 'arrow-right',
          },
        ],
      },
    ],
  },
  {
    label: 'Leasing',
    items: [
      { label: 'Applications', href: '/applications', icon: 'applications' },
      {
        label: 'Leases',
        href: '/leases',
        icon: 'leases',
        actions: [{ label: 'Create lease', href: '/leases/new', primary: true, icon: 'plus' }],
      },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Payments', href: '/payments', icon: 'payments' },
      // Returns and ROI are one workspace: property actuals sit beside projections there,
      // and the portfolio report is reached from it rather than as a competing entry.
      {
        label: 'Returns & ROI',
        href: '/roi-analysis',
        icon: 'roi-analysis',
        activeFor: ['/returns'],
      },
      { label: 'Rent Analysis', href: '/rent-analysis', icon: 'rent-analysis' },
      {
        label: 'Portfolio returns',
        href: '/returns',
        icon: 'returns',
        title: 'Portfolio returns',
        actions: [{ label: 'Export report', href: '/returns' }],
        hidden: true,
      },
      { label: 'Rent comps', href: '/rent-comps', icon: 'rent-comps', hidden: true },
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
    hideLabel: true,
    pinned: true,
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

/** True when the sidebar entry is current for pathname, including its related routes. */
export function isItemActive(pathname: string, item: ManagerNavItem): boolean {
  return (
    isActive(pathname, item.href) || !!item.activeFor?.some((href) => isActive(pathname, href))
  );
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
