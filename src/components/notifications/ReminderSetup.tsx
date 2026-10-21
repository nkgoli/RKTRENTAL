import type { Channels } from './model';
import styles from './Reminders.module.css';

export function ReminderSetup({ channels }: { channels: Channels }) {
  return (
    <section
      className={`card ${styles.workspace}`}
      id="payment-reminders"
      aria-labelledby="reminder-setup-heading"
    >
      <div>
        <p className="eyebrow">Email & text messages</p>
        <h2 id="reminder-setup-heading">Payment reminder setup</h2>
        <p>
          Reminder channels use their own organization settings. Payment processor connections do
          not configure email or SMS delivery.
        </p>
      </div>
      <div className="grid-2">
        {(['EMAIL', 'SMS'] as const).map((channel) => (
          <article key={channel}>
            <h3>{channel === 'EMAIL' ? 'Email · SMTP' : 'Text message · Twilio SMS'}</h3>
            <div className={channels[channel].mode === 'unavailable' ? styles.alert : styles.info}>
              <strong>
                {channels[channel].mode === 'sandbox'
                  ? 'Sandbox · not delivered'
                  : channels[channel].mode === 'live'
                    ? 'Configured · delivery unconfirmed'
                    : 'Unavailable'}
              </strong>
              <p>{channels[channel].message}</p>
            </div>
          </article>
        ))}
      </div>
      <details>
        <summary>Administrator setup steps</summary>
        <ol>
          <li>
            For testing, enable the sandbox environment. Sandbox records attempts without contacting
            recipients.
          </li>
          <li>
            For real sends, configure the existing organization’s SMTP relay or Twilio account, its
            sender and private deployment credentials. Enable live reminders and the matching
            organization connection. An administrator must provision this configuration; credentials
            are never entered on this page.
          </li>
          <li>
            SMTP requires an authenticated TLS relay and a verified sender domain. SMS requires an
            SMS-capable sender, verified tenant opt-in and the signed public delivery callback.
            Review server setup in <code>docs/notifications/payment-reminders.md</code>.
          </li>
          <li>
            Correct invalid contacts on the tenant record. Ask opted-out tenants to change their own
            preferences. Never override an opt-out to send a reminder.
          </li>
          <li>
            Return to the reminder, preview again, then intentionally send. Inspect history and
            provider status. Accepted email is not confirmed delivery.
          </li>
        </ol>
      </details>
    </section>
  );
}
