export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="hint" role="alert" style={{ color: 'var(--design-danger)' }}>
      {message}
    </span>
  );
}
