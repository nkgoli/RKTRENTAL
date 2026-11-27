import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { Channels } from './model';
import styles from './Reminders.module.css';

const CHANNELS = [
  { key: 'EMAIL', label: 'Email', provider: 'SMTP' },
  { key: 'SMS', label: 'Text message', provider: 'Twilio SMS' },
] as const;

const MODES: Record<Channels['EMAIL']['mode'], { tone: BadgeTone; label: string }> = {
  sandbox: { tone: 'warning', label: 'Sandbox · not delivered' },
  live: { tone: 'success', label: 'Live' },
  unavailable: { tone: 'danger', label: 'Unavailable' },
};

/** Email and SMS reminder channels on Integrations: one row and one status badge per channel. */
export function ReminderSetup({ channels }: { channels: Channels }) {
  return (
    <section className={styles.setup} id="payment-reminders" aria-labelledby="reminder-setup-heading">
      <h2 id="reminder-setup-heading">Payment reminders</h2>
      <div className="card">
        <ul className={styles.channelList}>
        {CHANNELS.map(({ key, label, provider }) => {
          const state = channels[key];
          return (
            <li key={key}>
              <span>
                <strong>{label}</strong> <span className={styles.muted}>· {provider}</span>
              </span>
              <Badge tone={MODES[state.mode].tone}>{MODES[state.mode].label}</Badge>
              {state.mode === 'unavailable' && (
                <p className={styles.channelError}>{state.message}</p>
              )}
            </li>
          );
        })}
      </ul>
        <details className={styles.setupSteps}>
          <summary>Setup steps</summary>
          <ol>
            <li>
              An administrator configures the SMTP relay or Twilio account and its credentials on
              the server (<code>docs/notifications/payment-reminders.md</code>); credentials are
              never entered on this page.
            </li>
            <li>SMS also needs a verified sender, tenant opt-in and the signed delivery callback.</li>
            <li>Never override a tenant opt-out. Accepted email is not confirmed delivery.</li>
          </ol>
        </details>
      </div>
    </section>
  );
}
