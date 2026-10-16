import styles from './leasing.module.css';

export type LeasingStat = { label: string; value: string | number; note?: string };

export function LeasingStats({ label, stats }: { label: string; stats: LeasingStat[] }) {
  return <section className={styles.stats} aria-label={label}>
    {stats.slice(0, 3).map((stat) => <article key={stat.label} className={styles.stat}>
      <span>{stat.label}</span>
      <strong>{stat.value}</strong>
      {stat.note && <small>{stat.note}</small>}
    </article>)}
  </section>;
}
