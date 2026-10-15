import styles from './provider-logo.module.css';

/** Navy-tinted provider mark; solid navy once the provider is connected. */
export function ProviderLogo({ logo, connected }: { logo: string; connected?: boolean }) {
  return (
    <span className={`${styles.logo}${connected ? ` ${styles.connected}` : ''}`} aria-hidden="true">
      {logo}
    </span>
  );
}
