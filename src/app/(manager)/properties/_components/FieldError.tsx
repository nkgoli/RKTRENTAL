export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <span id={id} className={styles.fieldError} role="alert">
      {message}
    </span>
  );
}
import styles from '../properties.module.css';
