// Exact approved light-system primitives; decorative beside visible labels.
export function PayIcon({ name }: { name: 'pay' | 'arrow' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
    >
      {name === 'pay' ? (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M6 15h4" />
        </>
      ) : (
        <path d="M5 12h14M14 7l5 5-5 5" />
      )}
    </svg>
  );
}
