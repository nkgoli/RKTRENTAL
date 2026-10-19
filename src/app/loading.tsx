import { LoadingState } from '@/components/RouteStates';
import { Icon } from '@/components/shell/Icons';
import styles from './(auth)/auth.module.css';

export default function Loading() {
  return (
    <main className={styles.page}>
      <div className={styles.publicState}>
        <div className={styles.brand} aria-label="RocketRental">
          <span className={styles.brandMark} aria-hidden="true">
            <Icon name="brand" />
          </span>
          <span>
            RocketRental<span className={styles.period}>.</span>
          </span>
        </div>
        <LoadingState />
      </div>
    </main>
  );
}
