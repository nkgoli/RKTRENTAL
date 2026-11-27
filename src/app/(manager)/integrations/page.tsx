import type { ReactNode } from 'react';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { formatRelative } from '@/lib/integrations/health';
import { loadIntegrations, type ProviderView } from '@/lib/integrations/service';
import {
  COMPS_RADII,
  COMPS_REFRESH,
  CONSENT_MODES,
  PAYOUT_ACCOUNTS,
  PAYOUT_SCHEDULES,
  SCREENING_PACKAGES,
} from '@/lib/integrations/settings';
import { Badge, Button, ConfirmButton, NoticeToast } from '@/components/ui';
import { PageHeader } from '@/components/shell/PageHeader';
import { providerActivityAt, providerSyncState } from '@/components/integrations/sync-state';
import styles from '@/components/integrations/integrations.module.css';
import { ProviderLogo } from '@/components/integrations/ProviderLogo';
import { connectAction, disconnectAction } from './actions';
import { FeeSwitch } from './FeeSwitch';
import { AutoSaveSettings } from './AutoSaveSettings';
import { ReminderSetup } from '@/components/notifications/ReminderSetup';
import { loadReminderChannels } from '@/components/notifications/server';

export const dynamic = 'force-dynamic';

type Options = readonly { readonly value: string; readonly label: string }[];

function Hidden({ provider }: { provider: ProviderView }) {
  return (
    <>
      <input type="hidden" name="kind" value={provider.kind} />
      <input type="hidden" name="provider" value={provider.provider} />
      <input type="hidden" name="name" value={provider.name} />
    </>
  );
}

function ProviderCard({ provider }: { provider: ProviderView }) {
  const sync = providerSyncState(provider);
  const activityAt = providerActivityAt(provider);
  return (
    <article
      className={`card ${styles.provider}`}
      data-provider={provider.provider}
      data-status={provider.status}
    >
      <div className={styles.providerHeader}>
        <div className={styles.identity}>
          <ProviderLogo logo={provider.logo} connected={provider.connected} />
          <div>
            <h3>{provider.name}</h3>
            <p className="muted">{provider.description}</p>
          </div>
        </div>
        {provider.connected ? (
          <Badge tone={provider.status === 'ERROR' ? 'danger' : 'success'}>
            {provider.status === 'ERROR'
              ? 'Error'
              : provider.mode === 'mock'
                ? 'Sandbox'
                : 'Connected'}
          </Badge>
        ) : (
          <Badge tone="info">Available</Badge>
        )}
      </div>
      {provider.connected ? (
        <>
          <dl className={styles.sync}>
            <dt>Sync status</dt>
            <dd>
              <Badge tone={sync.tone}>{sync.label}</Badge>
            </dd>
            <dt>{provider.mode === 'mock' ? 'Last sandbox activity' : 'Last recorded activity'}</dt>
            <dd>
              {activityAt ? (
                <time
                  dateTime={activityAt.toISOString()}
                  title={activityAt.toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC'}
                >
                  {formatRelative(activityAt)}
                </time>
              ) : (
                'No sync recorded'
              )}
            </dd>
          </dl>
          <details className={styles.configure}>
            <summary className="btn btn-secondary btn-sm">Configure {provider.name}</summary>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Mode</dt>
              <dd>
                {provider.mode === 'live' ? 'Live credentials' : 'Sandbox · simulated activity'}
              </dd>
              <dt>Credential</dt>
              <dd>
                <code>{provider.mode === 'live' ? provider.credentialRef : 'none'}</code>
                <span className="muted"> · value never shown</span>
              </dd>
              {provider.details.lastError && (
                <>
                  <dt>Last error</dt>
                  <dd>{provider.details.lastError}</dd>
                </>
              )}
            </dl>
            <ConfirmButton
              label="Disconnect"
              variant="danger"
              size="sm"
              title={`Disconnect ${provider.name}?`}
              description="New requests will stop using this provider until you reconnect. Existing records stay saved."
              confirmLabel="Disconnect"
              action={disconnectAction}
              fields={{ kind: provider.kind, provider: provider.provider, name: provider.name }}
            />
          </details>
        </>
      ) : (
        <form action={connectAction} className="row">
          <Hidden provider={provider} />
          <Button type="submit" variant="secondary" size="sm">
            Connect {provider.name}
          </Button>
        </form>
      )}
    </article>
  );
}

function SelectField({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: Options;
  value: string;
}) {
  return (
    <label className="field">
      {label}
      <select name={name} defaultValue={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className={styles.section}
      id={
        title === 'Payment providers'
          ? 'payments-providers'
          : title === 'Tenant screening providers'
            ? 'screening-providers'
            : 'comps-providers'
      }
    >
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requireManagerRole();
  const { notice, error } = await searchParams;
  const [view, reminderChannels] = await Promise.all([
    loadIntegrations(session.organizationId, db.providerConnection),
    loadReminderChannels(session.organizationId),
  ]);
  const { payments, screening, comps } = view.settings;
  const providers = [...view.groups.payments, ...view.groups.screening, ...view.groups.comps];
  const connected = providers.filter((provider) => provider.connected);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Integrations"
        meta={`${connected.length} of ${providers.length} providers connected`}
        actions={[]}
      />
      <nav className={styles.jumpLinks} aria-label="Integration groups">
        <a className="chip" href="#payment-reminders">
          Reminders
        </a>
        <a className="chip" href="#payments-providers">
          Payments
        </a>
        <a className="chip" href="#screening-providers">
          Screening
        </a>
        <a className="chip" href="#comps-providers">
          Rent comps
        </a>
      </nav>
      {error && <NoticeToast message={error} tone="error" />}
      {notice && <NoticeToast message={notice} />}
      {view.outages.map((provider) => (
        <div
          className="alert warning"
          role="alert"
          key={provider.provider}
          data-outage={provider.provider}
        >
          <span>!</span>
          <div>
            <strong>
              {provider.name}{' '}
              {provider.health.state === 'failed' ? 'sync failed' : 'webhook failed'}.
            </strong>
            <br />
            {provider.details.lastError ??
              'The last provider event could not be processed; it will retry automatically.'}
          </div>
        </div>
      ))}
      <ReminderSetup channels={reminderChannels} />

      <Section title="Payment providers">
        <div className="grid-2">
          {view.groups.payments.map((provider) => (
            <ProviderCard key={provider.provider} provider={provider} />
          ))}
        </div>
        <AutoSaveSettings group="payments" title="Payment settings">
          <div className="form-row">
            <SelectField
              label="Payout account"
              name="payoutAccount"
              options={PAYOUT_ACCOUNTS}
              value={payments.payoutAccount}
            />
            <SelectField
              label="Payout schedule"
              name="payoutSchedule"
              options={PAYOUT_SCHEDULES}
              value={payments.payoutSchedule}
            />
          </div>
          <div className="row between">
            <strong>Pass processing fees to tenant</strong>
            <FeeSwitch
              name="passProcessingFees"
              initial={payments.passProcessingFees}
              label="Pass processing fees to tenant"
            />
          </div>
        </AutoSaveSettings>
      </Section>

      <Section title="Tenant screening providers">
        <div className="grid-2">
          {view.groups.screening.map((provider) => (
            <ProviderCard key={provider.provider} provider={provider} />
          ))}
        </div>
        <AutoSaveSettings group="screening" title="Screening settings">
          <div className="form-row">
            <SelectField
              label="Default screening package"
              name="defaultPackage"
              options={SCREENING_PACKAGES}
              value={screening.defaultPackage}
            />
            <SelectField
              label="Applicant consent"
              name="applicantConsent"
              options={CONSENT_MODES}
              value={screening.applicantConsent}
            />
          </div>
        </AutoSaveSettings>
      </Section>

      <Section title="Rent comps data providers">
        <div className="grid-2">
          {view.groups.comps.map((provider) => (
            <ProviderCard key={provider.provider} provider={provider} />
          ))}
        </div>
        <AutoSaveSettings group="comps" title="Rent comps settings">
          <div className="form-row">
            <SelectField
              label="Default search radius"
              name="radiusMiles"
              options={COMPS_RADII}
              value={String(comps.radiusMiles)}
            />
            <SelectField
              label="Data refresh"
              name="refresh"
              options={COMPS_REFRESH}
              value={comps.refresh}
            />
          </div>
        </AutoSaveSettings>
      </Section>
    </div>
  );
}
