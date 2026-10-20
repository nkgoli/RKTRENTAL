export function TemplateIcon({ name }: { name: 'add' | 'arrow' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={name === 'add' ? 'M12 5v14M5 12h14' : 'M5 12h14M14 7l5 5-5 5'} />
    </svg>
  );
}
