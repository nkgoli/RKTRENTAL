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
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PageHeader } from '@/components/shell/PageHeader';
import { providerActivityAt, providerSyncState } from '@/components/integrations/sync-state';
import styles from '@/components/integrations/integrations.module.css';
import { ProviderLogo } from '@/components/integrations/ProviderLogo';
import { connectAction, disconnectAction } from './actions';
import { FeeSwitch } from './FeeSwitch';
import { AutoSaveSettings } from './AutoSaveSettings';

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
          {!provider.health.outage && (
            <p className={styles.hint}>
              {provider.mode === 'mock'
                ? 'Simulated activity only. No live provider transactions.'
                : 'Activity includes connection setup and provider updates. It does not verify current availability.'}
            </p>
          )}
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
            <ConfirmButton label="Disconnect" variant="danger" size="sm" title={`Disconnect ${provider.name}?`} description="New requests will stop using this provider until you reconnect. Existing records stay saved." confirmLabel="Disconnect" action={disconnectAction} fields={{ kind: provider.kind, provider: provider.provider, name: provider.name }} />
          </details>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 18 }}>
            {provider.availableText}
          </p>
          <form action={connectAction} className="row" style={{ marginTop: 18 }}>
            <Hidden provider={provider} />
            <Button type="submit" variant="primary" size="sm">
              Connect {provider.name}
            </Button>
          </form>
        </>
      )}
    </article>
  );
}

function SelectField({
  label,
  name,
  options,
  value,
  hint,
}: {
  label: string;
  name: string;
  options: Options;
  value: string;
  hint?: string;
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
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
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
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
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
  const view = await loadIntegrations(session.organizationId, db.providerConnection);
  const { payments, screening, comps } = view.settings;
  const providers = [...view.groups.payments, ...view.groups.screening, ...view.groups.comps];
  const connected = providers.filter((provider) => provider.connected);
  const attention = providers.filter((provider) => provider.connected && provider.health.outage);

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Settings" title="Integrations" actions={[]} />
      <nav className={styles.jumpLinks} aria-label="Provider groups">
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
      <section className="kpis" aria-label="Integration status">
        <KpiCard
          label="Connected providers"
          value={connected.length}
          note={`of ${providers.length} available`}
        />
        <KpiCard
          label="Activity recorded"
          value={connected.filter((provider) => providerSyncState(provider).recorded).length}
          note="Live connections with setup or provider activity"
        />
        <KpiCard
          label="Needs attention"
          value={attention.length}
          note={attention.length ? 'Check sync errors below' : 'No reported errors'}
        />
      </section>
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
              'The last provider event could not be processed; it will retry automatically.'}{' '}
            Status will update when the connection recovers.
          </div>
        </div>
      ))}

      <Section
        eyebrow="Collect and disburse"
        title="Payment providers"
        description="Cards, bank transfers, owner payouts and refunds in one ledger."
      >
        <div className="grid-2">
          {view.groups.payments.map((provider) => (
            <ProviderCard key={provider.provider} provider={provider} />
          ))}
        </div>
        <AutoSaveSettings
          group="payments"
          title="Payment settings"
          description="Applied to connected payment providers."
        >
          <div className="form-row">
            <SelectField
              label="Payout account"
              name="payoutAccount"
              options={PAYOUT_ACCOUNTS}
              value={payments.payoutAccount}
              hint="Owner payouts run on the schedule below."
            />
            <SelectField
              label="Payout schedule"
              name="payoutSchedule"
              options={PAYOUT_SCHEDULES}
              value={payments.payoutSchedule}
              hint="Changes apply to upcoming batches."
            />
          </div>
          <div className="row between">
            <div>
              <strong>Pass processing fees to tenant</strong>
              <p className="muted">Shown before a tenant confirms payment.</p>
            </div>
            <FeeSwitch
              name="passProcessingFees"
              initial={payments.passProcessingFees}
              label="Pass processing fees to tenant"
            />
          </div>
        </AutoSaveSettings>
      </Section>

      <Section
        eyebrow="Screen with confidence"
        title="Tenant screening providers"
        description="Consent and report results stay with each application."
      >
        <div className="grid-2">
          {view.groups.screening.map((provider) => (
            <ProviderCard key={provider.provider} provider={provider} />
          ))}
        </div>
        <AutoSaveSettings
          group="screening"
          title="Screening settings"
          description="Choose the package for new applications."
        >
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
              hint="Reports are requested only after consent."
            />
          </div>
        </AutoSaveSettings>
      </Section>

      <Section
        eyebrow="Price with confidence"
        title="Rent comps data providers"
        description="Comparable rental listings and lease data for pricing decisions."
      >
        <div className="grid-2">
          {view.groups.comps.map((provider) => (
            <ProviderCard key={provider.provider} provider={provider} />
          ))}
        </div>
        <AutoSaveSettings
          group="comps"
          title="Rent comps settings"
          description="Defaults for rental comparisons."
        >
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
