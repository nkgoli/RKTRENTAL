export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="hint" role="alert" style={{ color: 'var(--design-danger)' }}>
      {message}
    </span>
  );
}
