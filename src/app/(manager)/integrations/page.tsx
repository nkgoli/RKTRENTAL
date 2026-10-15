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
import { Alert, Badge, Button } from '@/components/ui';
import { PageHero } from '@/components/dashboard/PageHero';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { IconAlert, IconCheck, IconPlug } from '@/components/dashboard/icons';
import { ProviderLogo } from '@/components/integrations/ProviderLogo';
import { connectAction, disconnectAction, saveSettingsAction } from './actions';
import { FeeSwitch } from './FeeSwitch';

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
  const { health } = provider;
  return (
    <article className="card" data-provider={provider.provider} data-status={provider.status}>
      <div className="row between">
        <div className="provider">
          <ProviderLogo logo={provider.logo} connected={provider.connected} />
          <div>
            <h3>{provider.name}</h3>
            <p className="muted">{provider.description}</p>
          </div>
        </div>
        {provider.connected ? (
          <Badge tone={provider.status === 'ERROR' ? 'danger' : 'success'}>
            {provider.status === 'ERROR' ? 'Error' : 'Connected'}
          </Badge>
        ) : (
          <Badge tone="info">Available</Badge>
        )}
      </div>
      {provider.connected ? (
        <>
          <div className="row between" style={{ marginTop: 18 }}>
            <span className="muted">Sync health</span>
            <Badge tone={health.tone}>{health.label}</Badge>
          </div>
          <div className="row between" style={{ marginTop: 14 }}>
            <span className="muted">Last synced</span>
            <strong>{formatRelative(provider.lastSyncAt)}</strong>
          </div>
          <details style={{ marginTop: 18 }}>
            <summary className="btn btn-secondary btn-sm">Configure</summary>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Mode</dt>
              <dd>
                {provider.mode === 'live' ? 'Live credentials' : 'Mock adapter (development)'}
              </dd>
              <dt>Credential</dt>
              <dd>
                <code>{provider.mode === 'live' ? provider.credentialRef : 'none'}</code>
                <span className="muted"> � value never shown</span>
              </dd>
              {provider.details.lastError && (
                <>
                  <dt>Last error</dt>
                  <dd>{provider.details.lastError}</dd>
                </>
              )}
            </dl>
            <form action={disconnectAction} style={{ marginTop: 12 }}>
              <Hidden provider={provider} />
              <Button type="submit" variant="danger" size="sm">
                Disconnect
              </Button>
            </form>
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

function SettingsCard({
  group,
  title,
  description,
  children,
}: {
  group: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <form action={saveSettingsAction} className="card" aria-label={title} id={`${group}-settings`}>
      <input type="hidden" name="group" value={group} />
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <Button type="submit" variant="primary" size="sm">
          Save settings
        </Button>
      </div>
      <div className="form">{children}</div>
    </form>
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
    <section className="stack">
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
  const attention = providers.filter(
    (provider) => provider.connected && (provider.status === 'ERROR' || provider.health.tone === 'danger'),
  );
  const connectedPercent = providers.length
    ? Math.round((connected.length / providers.length) * 100)
    : 0;

  return (
    <div className="page" style={{ padding: 0 }}>
      <PageHero eyebrow="Connections" title="Integrations">
        Payments, screening and rent comps providers in one place. {connected.length} of {providers.length}{' '}
        connected.
      </PageHero>
      <section className="grid-3" aria-label="Integration status">
        <KpiCard
          label="Connected providers"
          value={connected.length}
          note={`of ${providers.length} available`}
          icon={<IconPlug />}
          ring={connectedPercent}
          ringLabel={`% of providers connected`}
        />
        <KpiCard
          label="Healthy connections"
          value={connected.length - attention.length}
          note="Syncing normally"
          icon={<IconCheck />}
          tone="green"
        />
        <KpiCard
          label="Needs attention"
          value={attention.length}
          note={attention.length ? 'Check sync errors below' : 'No sync problems'}
          icon={<IconAlert />}
          tone={attention.length ? 'coral' : 'green'}
          trend={attention.length ? ` failing` : 'All clear'}
          trendWarm={attention.length > 0}
        />
      </section>
      {error && (
        <Alert tone="warning">
          <div role="alert">{error}</div>
        </Alert>
      )}
      {notice && (
        <Alert tone="success">
          <div>{notice}</div>
        </Alert>
      )}
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
        <SettingsCard
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
        </SettingsCard>
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
        <SettingsCard
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
        </SettingsCard>
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
        <SettingsCard
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
        </SettingsCard>
      </Section>
    </div>
  );
}
