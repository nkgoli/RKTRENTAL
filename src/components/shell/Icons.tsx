import type { IconName } from './nav';
const icons = {
  brand: (
    <svg focusable="false" aria-hidden="true" viewBox="0 0 32 32" fill="none">
      <path
        d="M9 25V7h9a6 6 0 0 1 1 12l6 6M9 17h9"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="square"
      ></path>
      <path d="M23 5l4-2-2 4" fill="currentColor"></path>
    </svg>
  ),
  dashboard: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.4"></rect>
      <rect x="14" y="3" width="7" height="7" rx="1.4"></rect>
      <rect x="3" y="14" width="7" height="7" rx="1.4"></rect>
      <rect x="14" y="14" width="7" height="7" rx="1.4"></rect>
    </svg>
  ),
  properties: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21V4h10v17M14 9h6v12M2 21h20M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1"></path>
    </svg>
  ),
  tenants: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3"></circle>
      <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"></path>
    </svg>
  ),
  applications: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="4" width="14" height="17" rx="2"></rect>
      <path d="M9 4V2h6v2M8 13l3 3 5-6"></path>
    </svg>
  ),
  leases: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H5v18h14V8zM14 3v5h5M9 13h6M9 17h4"></path>
    </svg>
  ),
  payments: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2"></rect>
      <path d="M2 10h20M6 15h4"></path>
    </svg>
  ),
  'roi-analysis': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 18l6-7 4 3 8-9M15 5h6v6M3 22h18"></path>
    </svg>
  ),
  'rent-analysis': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11l9-8 9 8M6 10v11h12V10M10 21v-7h4v7"></path>
    </svg>
  ),
  returns: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21V12M10 21V7M16 21V3M2 21h20"></path>
    </svg>
  ),
  maintenance: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 6a5 5 0 0 0 6 6l-9 9a2 2 0 0 1-3-3l9-9a5 5 0 0 0 3-6l-3 3-3-3z"></path>
    </svg>
  ),
  documents: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h6l2 2h10v12H3z"></path>
    </svg>
  ),
  integrations: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3v5M16 3v5M5 8h14v4a7 7 0 0 1-14 0zM12 19v3"></path>
    </svg>
  ),
  'chevron-right': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 5l7 7-7 7"></path>
    </svg>
  ),
  plus: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14"></path>
    </svg>
  ),
  'arrow-right': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M14 7l5 5-5 5"></path>
    </svg>
  ),
  'property-house': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 17L20 5l16 12M8 15v19h24V15M17 34V23h7v11M12 19h3M26 19h3"></path>
    </svg>
  ),
  'property-townhomes': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 15l9-7 8 7 8-7 9 7M6 13v22h28V13M19 15v20M10 19h4M24 19h5M10 26h4M24 26h5"></path>
    </svg>
  ),
  'property-lofts': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 35V7h30v28M3 35h34M11 13h4M24 13h4M11 20h4M24 20h4M11 27h4M24 27h4"></path>
    </svg>
  ),
  'property-court': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 35V11h10V5h10v6h10v24M3 35h34M11 17h4M25 17h4M11 24h4M25 24h4M18 35V23h4v12"></path>
    </svg>
  ),
  'arrow-left': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M10 7l-5 5 5 5"></path>
    </svg>
  ),
  close: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12M18 6L6 18"></path>
    </svg>
  ),
  more: (
    <svg focusable="false" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.8"></circle>
      <circle cx="12" cy="12" r="1.8"></circle>
      <circle cx="19" cy="12" r="1.8"></circle>
    </svg>
  ),
  info: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 11v5M12 8h.01"></path>
    </svg>
  ),
  check: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l5 5 9-10"></path>
    </svg>
  ),
  search: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7"></circle>
      <path d="m20 20-3.5-3.5"></path>
    </svg>
  ),
  download: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v11M7 10l5 5 5-5M4 19h16"></path>
    </svg>
  ),
  eye: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  ),
  'sign-out': (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 4H5v16h5M14 8l5 4-5 4M19 12H9"></path>
    </svg>
  ),
  trash: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"></path>
    </svg>
  ),
  home: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5"></path>
    </svg>
  ),
  bell: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"></path>
    </svg>
  ),
  menu: (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16"></path>
    </svg>
  ),
};
export type IconKey = keyof typeof icons;
export function Icon({ name }: { name: IconKey | IconName }) {
  return icons[name === 'rent-comps' ? 'rent-analysis' : name];
}
