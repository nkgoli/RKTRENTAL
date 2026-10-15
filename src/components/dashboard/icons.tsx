import type { ReactNode } from 'react';

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const icon = (children: ReactNode) =>
  function Icon() {
    return <svg {...base}>{children}</svg>;
  };

export const IconCash = icon(
  <>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </>,
);
export const IconAlert = icon(
  <>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17.5v.01" />
  </>,
);
export const IconCalendar = icon(
  <>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </>,
);
export const IconWrench = icon(
  <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
);
export const IconBuilding = icon(
  <>
    <path d="M5 20V5l8-2v17M13 9h6v11M3 20h18" />
    <path d="M8 8h2M8 12h2M8 16h2" />
  </>,
);
export const IconChart = icon(<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />);
export const IconPercent = icon(
  <>
    <path d="M19 5L5 19" />
    <circle cx="7.5" cy="7.5" r="2" />
    <circle cx="16.5" cy="16.5" r="2" />
  </>,
);
export const IconPlug = icon(<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />);
export const IconCheck = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconBank = icon(<path d="M3 9l9-5 9 5M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" />);
