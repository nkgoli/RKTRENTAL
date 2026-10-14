import type { Prisma, ProviderConnectionStatus, ProviderKind } from '@prisma/client';
import { PROVIDERS, findProvider, providersFor, type IntegrationGroup } from './catalog';
import { readHealth, summarizeHealth, type ConnectionHealth, type HealthSummary } from './health';
import {
  GROUP_KIND,
  SETTINGS_PROVIDER,
  parseSettings,
  readSettings,
  type SettingsByGroup,
} from './settings';

export type ConnectionRow = {
  kind: ProviderKind;
  provider: string;
  status: ProviderConnectionStatus;
  settings: unknown;
  lastSyncAt: Date | null;
};

/** The slice of the Prisma ProviderConnection delegate this module needs. */
export type ConnectionStore = {
  findMany(args: { where: { organizationId: string } }): Promise<ConnectionRow[]>;
  upsert(args: {
    where: {
      organizationId_kind_provider: {
        organizationId: string;
        kind: ProviderKind;
        provider: string;
      };
    };
    create: {
      organizationId: string;
      kind: ProviderKind;
      provider: string;
      status: ProviderConnectionStatus;
      settings: Prisma.InputJsonValue;
      lastSyncAt?: Date | null;
    };
    update: {
      status?: ProviderConnectionStatus;
      settings?: Prisma.InputJsonValue;
      lastSyncAt?: Date | null;
    };
  }): Promise<unknown>;
};

export class IntegrationError extends Error {}

export type ProviderView = {
  kind: ProviderKind;
  group: IntegrationGroup;
  provider: string;
  name: string;
  logo: string;
  description: string;
  availableText?: string;
  connected: boolean;
  status: ProviderConnectionStatus;
  mode: 'live' | 'mock' | null;
  /** Names the credential source only (env:NAME); the credential value is never loaded. */
  credentialRef: string;
  credentialPresent: boolean;
  health: HealthSummary;
  details: ConnectionHealth;
  lastSyncAt: Date | null;
};

export type IntegrationsView = {
  groups: Record<IntegrationGroup, ProviderView[]>;
  settings: SettingsByGroup;
  outages: ProviderView[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export async function loadIntegrations(
  organizationId: string,
  store: ConnectionStore,
  env: NodeJS.ProcessEnv = process.env,
): Promise<IntegrationsView> {
  const rows = await store.findMany({ where: { organizationId } });
  const find = (kind: ProviderKind, provider: string) =>
    rows.find((row) => row.kind === kind && row.provider === provider);

  const views = PROVIDERS.map((definition): ProviderView => {
    const row = find(definition.kind, definition.provider);
    const status = row?.status ?? 'DISCONNECTED';
    const stored = asRecord(row?.settings);
    const details = readHealth(row?.settings);
    return {
      ...definition,
      connected: status !== 'DISCONNECTED',
      status,
      mode: status === 'DISCONNECTED' ? null : stored.mode === 'live' ? 'live' : 'mock',
      credentialRef: `env:${definition.credentialEnv}`,
      credentialPresent: Boolean(env[definition.credentialEnv]),
      health: summarizeHealth(status, details),
      details,
      lastSyncAt: row?.lastSyncAt ?? null,
    };
  });

  const groups = {
    payments: views.filter((view) => view.group === 'payments'),
    screening: views.filter((view) => view.group === 'screening'),
    comps: views.filter((view) => view.group === 'comps'),
  };
  const settingsOf = <G extends IntegrationGroup>(group: G) =>
    readSettings(group, find(GROUP_KIND[group], SETTINGS_PROVIDER)?.settings);

  return {
    groups,
    settings: {
      payments: settingsOf('payments'),
      screening: settingsOf('screening'),
      comps: settingsOf('comps'),
    },
    outages: views.filter((view) => view.connected && view.health.outage),
  };
}

export async function connectProvider(
  organizationId: string,
  kind: string,
  provider: string,
  store: ConnectionStore,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
) {
  const definition = findProvider(kind, provider);
  if (!definition) throw new IntegrationError('Unknown provider');
  const live = Boolean(env[definition.credentialEnv]);
  if (!live && env.NODE_ENV === 'production')
    throw new IntegrationError(`Set ${definition.credentialEnv} in the server environment first`);

  const existing = (await store.findMany({ where: { organizationId } })).find(
    (row) => row.kind === definition.kind && row.provider === definition.provider,
  );
  const { health: _health, ...kept } = asRecord(existing?.settings);
  void _health;
  const settings = {
    ...kept,
    mode: live ? 'live' : 'mock',
    credentialRef: live ? `env:${definition.credentialEnv}` : 'mock',
    health: { lastSyncStatus: 'ok', lastWebhookStatus: 'ok', lastSyncAt: now.toISOString() },
  } satisfies Prisma.InputJsonObject;
  const key = { organizationId, kind: definition.kind, provider: definition.provider };
  await store.upsert({
    where: { organizationId_kind_provider: key },
    create: { ...key, status: 'CONNECTED', settings, lastSyncAt: now },
    update: { status: 'CONNECTED', settings, lastSyncAt: now },
  });
}

export async function disconnectProvider(
  organizationId: string,
  kind: string,
  provider: string,
  store: ConnectionStore,
) {
  const definition = findProvider(kind, provider);
  if (!definition) throw new IntegrationError('Unknown provider');
  const existing = (await store.findMany({ where: { organizationId } })).find(
    (row) => row.kind === definition.kind && row.provider === definition.provider,
  );
  if (!existing) return;
  const { health: _health, ...kept } = asRecord(existing.settings);
  void _health;
  const key = { organizationId, kind: definition.kind, provider: definition.provider };
  await store.upsert({
    where: { organizationId_kind_provider: key },
    create: { ...key, status: 'DISCONNECTED', settings: kept as Prisma.InputJsonObject },
    update: { status: 'DISCONNECTED', settings: kept as Prisma.InputJsonObject },
  });
}

export async function saveGroupSettings(
  organizationId: string,
  group: IntegrationGroup,
  input: Record<string, unknown>,
  store: ConnectionStore,
) {
  if (!providersFor(group).length) throw new IntegrationError('Unknown settings group');
  const settings = parseSettings(group, input) as Prisma.InputJsonObject;
  const key = { organizationId, kind: GROUP_KIND[group], provider: SETTINGS_PROVIDER };
  await store.upsert({
    where: { organizationId_kind_provider: key },
    create: { ...key, status: 'DISCONNECTED', settings },
    update: { settings },
  });
}

/** Called by webhook intake or sync jobs to record an outcome that the integrations page surfaces. */
export async function recordProviderHealth(
  organizationId: string,
  kind: ProviderKind,
  provider: string,
  outcome: { webhook?: 'ok' | 'failed'; sync?: 'ok' | 'failed'; error?: string },
  store: ConnectionStore,
  now = new Date(),
) {
  const existing = (await store.findMany({ where: { organizationId } })).find(
    (row) => row.kind === kind && row.provider === provider,
  );
  if (!existing) return;
  const stored = asRecord(existing.settings);
  const health: Record<string, string> = { ...(asRecord(stored.health) as Record<string, string>) };
  if (outcome.webhook) {
    health.lastWebhookStatus = outcome.webhook;
    health.lastWebhookAt = now.toISOString();
  }
  if (outcome.sync) {
    health.lastSyncStatus = outcome.sync;
    health.lastSyncAt = now.toISOString();
  }
  if (outcome.error) health.lastError = outcome.error.slice(0, 200);
  else if (outcome.webhook === 'ok' || outcome.sync === 'ok') delete health.lastError;
  const settings = { ...stored, health } as Prisma.InputJsonObject;
  const key = { organizationId, kind, provider };
  await store.upsert({
    where: { organizationId_kind_provider: key },
    create: { ...key, status: existing.status, settings },
    update: {
      settings,
      ...(outcome.sync === 'ok' ? { lastSyncAt: now } : {}),
    },
  });
}
