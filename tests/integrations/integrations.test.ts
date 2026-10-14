import { describe, expect, it } from 'vitest';
import {
  IntegrationError,
  connectProvider,
  disconnectProvider,
  loadIntegrations,
  recordProviderHealth,
  saveGroupSettings,
  type ConnectionRow,
  type ConnectionStore,
} from '../../src/lib/integrations/service';
import { formatRelative, summarizeHealth } from '../../src/lib/integrations/health';
import { SettingsError, parseSettings, readSettings } from '../../src/lib/integrations/settings';

const org = 'org-1';
const env = (values: Record<string, string> = {}) => values as unknown as NodeJS.ProcessEnv;

function memoryStore() {
  const rows: (ConnectionRow & { organizationId: string })[] = [];
  const store: ConnectionStore = {
    async findMany({ where }) {
      return rows.filter((row) => row.organizationId === where.organizationId);
    },
    async upsert({ where, create, update }) {
      const key = where.organizationId_kind_provider;
      const found = rows.find(
        (row) =>
          row.organizationId === key.organizationId &&
          row.kind === key.kind &&
          row.provider === key.provider,
      );
      if (found) Object.assign(found, update);
      else rows.push({ lastSyncAt: null, ...create });
    },
  };
  return { rows, store };
}

describe('settings validation', () => {
  it('parses each group and rejects unsupported values', () => {
    expect(
      parseSettings('payments', {
        payoutAccount: 'operating-4082',
        payoutSchedule: 'weekly',
        passProcessingFees: 'false',
      }),
    ).toEqual({
      payoutAccount: 'operating-4082',
      payoutSchedule: 'weekly',
      passProcessingFees: false,
    });
    expect(parseSettings('comps', { radiusMiles: '3', refresh: 'weekly' })).toEqual({
      radiusMiles: 3,
      refresh: 'weekly',
    });
    expect(() => parseSettings('comps', { radiusMiles: '99', refresh: 'daily' })).toThrow(
      SettingsError,
    );
    expect(() =>
      parseSettings('screening', {
        defaultPackage: 'x',
        applicantConsent: 'required-before-report',
      }),
    ).toThrow(SettingsError);
  });

  it('falls back to defaults for missing or invalid stored values', () => {
    expect(readSettings('comps', null)).toEqual({ radiusMiles: 2, refresh: 'daily' });
    expect(readSettings('comps', { radiusMiles: 42 })).toEqual({
      radiusMiles: 2,
      refresh: 'daily',
    });
  });
});

describe('connections', () => {
  it('connects Checkr in mock mode outside production and stores no credential value', async () => {
    const { rows, store } = memoryStore();
    await connectProvider(
      org,
      'SCREENING',
      'checkr',
      store,
      env(),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'checkr', status: 'CONNECTED' });
    expect(JSON.stringify(rows[0].settings)).not.toMatch(/sk_|secret/i);
    expect(rows[0].settings).toMatchObject({ mode: 'mock', credentialRef: 'mock' });
  });

  it('stores only an env reference when the credential is configured', async () => {
    const { rows, store } = memoryStore();
    await connectProvider(
      org,
      'COMPS',
      'rentometer',
      store,
      env({ RENTOMETER_API_KEY: 'super-secret-value' }),
    );
    const json = JSON.stringify(rows[0].settings);
    expect(json).toContain('env:RENTOMETER_API_KEY');
    expect(json).not.toContain('super-secret-value');
    const view = await loadIntegrations(
      org,
      store,
      env({ RENTOMETER_API_KEY: 'super-secret-value' }),
    );
    expect(JSON.stringify(view)).not.toContain('super-secret-value');
  });

  it('refuses to connect in production without a credential and rejects unknown providers', async () => {
    const { store } = memoryStore();
    await expect(
      connectProvider(org, 'SCREENING', 'checkr', store, env({ NODE_ENV: 'production' })),
    ).rejects.toThrow(/CHECKR_API_KEY/);
    await expect(connectProvider(org, 'SCREENING', 'nope', store, env())).rejects.toThrow(
      IntegrationError,
    );
  });

  it('disconnects without deleting and clears health', async () => {
    const { rows, store } = memoryStore();
    await connectProvider(org, 'PAYMENTS', 'stripe', store, env());
    await disconnectProvider(org, 'PAYMENTS', 'stripe', store);
    expect(rows[0].status).toBe('DISCONNECTED');
    expect(JSON.stringify(rows[0].settings)).not.toContain('health');
    const view = await loadIntegrations(org, store, env());
    expect(view.groups.payments.find((p) => p.provider === 'stripe')?.connected).toBe(false);
  });

  it('isolates organizations', async () => {
    const { store } = memoryStore();
    await connectProvider('other-org', 'SCREENING', 'checkr', store, env());
    const view = await loadIntegrations(org, store, env());
    expect(view.groups.screening.every((p) => !p.connected)).toBe(true);
  });
});

describe('group settings', () => {
  it('saves and reloads settings under the settings row', async () => {
    const { rows, store } = memoryStore();
    await saveGroupSettings(org, 'comps', { radiusMiles: '3', refresh: 'weekly' }, store);
    expect(rows[0]).toMatchObject({ kind: 'COMPS', provider: 'settings', status: 'DISCONNECTED' });
    const view = await loadIntegrations(org, store, env());
    expect(view.settings.comps).toEqual({ radiusMiles: 3, refresh: 'weekly' });
    await expect(saveGroupSettings(org, 'comps', { radiusMiles: '7' }, store)).rejects.toThrow(
      SettingsError,
    );
  });
});

describe('health and outage alerts', () => {
  it('flags an outage after a failed webhook or sync, and clears it on success', async () => {
    const { store } = memoryStore();
    await connectProvider(org, 'PAYMENTS', 'stripe', store, env());
    expect((await loadIntegrations(org, store, env())).outages).toHaveLength(0);

    await recordProviderHealth(
      org,
      'PAYMENTS',
      'stripe',
      { webhook: 'failed', error: 'timeout' },
      store,
    );
    let view = await loadIntegrations(org, store, env());
    expect(view.outages.map((p) => p.provider)).toEqual(['stripe']);
    expect(view.outages[0].health.label).toBe('Retrying');
    expect(view.outages[0].details.lastError).toBe('timeout');

    await recordProviderHealth(org, 'PAYMENTS', 'stripe', { webhook: 'ok', sync: 'ok' }, store);
    view = await loadIntegrations(org, store, env());
    expect(view.outages).toHaveLength(0);

    await recordProviderHealth(org, 'PAYMENTS', 'stripe', { sync: 'failed' }, store);
    view = await loadIntegrations(org, store, env());
    expect(view.outages[0].health.label).toBe('Sync failed');
  });

  it('summarizes status and formats relative times', () => {
    expect(summarizeHealth('DISCONNECTED', {}).outage).toBe(false);
    expect(summarizeHealth('ERROR', {}).outage).toBe(true);
    const now = new Date('2026-01-01T12:00:00Z');
    expect(formatRelative(null, now)).toBe('Never');
    expect(formatRelative(new Date('2026-01-01T11:58:00Z'), now)).toBe('2 minutes ago');
    expect(formatRelative(new Date('2026-01-01T09:00:00Z'), now)).toBe('3 hours ago');
  });
});
