import { Avatar } from '../ui/Badge';

export function AccountMenu({ initials }: { initials: string }) {
  return (
    <details style={{ position: 'relative' }}>
      <summary aria-label="Account menu" style={{ cursor: 'pointer', listStyle: 'none' }}>
        <Avatar initials={initials} size="sm" />
      </summary>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          zIndex: 20,
          minWidth: 140,
          padding: 6,
          border: '1px solid var(--rr-border)',
          borderRadius: 8,
          background: 'var(--design-surface)',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        }}
      >
        <a
          href="/sign-out"
          style={{
            display: 'block',
            padding: '8px 10px',
            color: 'var(--design-text)',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Sign out
        </a>
      </div>
    </details>
  );
}
