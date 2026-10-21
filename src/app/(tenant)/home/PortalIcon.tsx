// Approved light-system geometry, kept local to the Home/Lease rollout.
export function PortalIcon({
  name,
}: {
  name: 'pay' | 'lease' | 'repair' | 'folder' | 'arrow' | 'building' | 'eye' | 'download';
}) {
  if (name === 'building')
    return (
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
        <path d="M5 35V11h10V5h10v6h10v24M3 35h34M11 17h4M25 17h4M11 24h4M25 24h4M18 35V23h4v12" />
      </svg>
    );
  return (
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
      {name === 'pay' && (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M6 15h4" />
        </>
      )}
      {name === 'lease' && <path d="M14 3H5v18h14V8zM14 3v5h5M9 13h6M9 17h4" />}
      {name === 'repair' && (
        <path d="M14 6a5 5 0 0 0 6 6l-9 9a2 2 0 0 1-3-3l9-9a5 5 0 0 0 3-6l-3 3-3-3z" />
      )}
      {name === 'folder' && <path d="M3 6h6l2 2h10v12H3z" />}
      {name === 'arrow' && <path d="M5 12h14M14 7l5 5-5 5" />}
      {name === 'eye' && (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
      {name === 'download' && <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />}
    </svg>
  );
}
