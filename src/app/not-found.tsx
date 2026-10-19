import { Button } from '@/components/ui/Button';
import styles from './(auth)/auth.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>R</span>RocketRental
        </div>
        <p className={styles.eyebrow}>Page unavailable</p>
        <h1>Page not found</h1>
        <p className={styles.description}>
          This link may have changed or the page is no longer available.
        </p>
        <Button href="/" variant="primary" block>
          Return to your account
        </Button>
      </section>
    </main>
  );
}
