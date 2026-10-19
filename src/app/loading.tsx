import { LoadingState } from '@/components/RouteStates';
import styles from './(auth)/auth.module.css';

export default function Loading() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <LoadingState />
      </div>
    </main>
  );
}
