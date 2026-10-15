import type { ReactNode } from 'react';
import styles from './hero.module.css';

/** Page hero: eyebrow, heading and one line of context, with optional trailing content. */
export function PageHero({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={styles.hero} aria-label={title}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
        {children && <p className={styles.lede}>{children}</p>}
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
