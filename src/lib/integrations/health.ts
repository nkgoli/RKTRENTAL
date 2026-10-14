import type { ProviderConnectionStatus } from '@prisma/client';

/** Webhook and sync outcomes recorded by adapters and the webhook intake in ProviderConnection.settings.health. */
export type ConnectionHealth = {
  lastWebhookStatus?: 'ok' | 'failed';
  lastWebhookAt?: string;
  lastSyncStatus?: 'ok' | 'failed';
  lastSyncAt?: string;
  lastError?: string;
};

export type HealthSummary = {
  state: 'healthy' | 'retrying' | 'failed' | 'idle';
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  outage: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function readHealth(settings: unknown): ConnectionHealth {
  const raw = asRecord(asRecord(settings).health);
  const status = (value: unknown) => (value === 'ok' || value === 'failed' ? value : undefined);
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 200) : undefined);
  return {
    lastWebhookStatus: status(raw.lastWebhookStatus),
    lastWebhookAt: text(raw.lastWebhookAt),
    lastSyncStatus: status(raw.lastSyncStatus),
    lastSyncAt: text(raw.lastSyncAt),
    lastError: text(raw.lastError),
  };
}

export function summarizeHealth(
  status: ProviderConnectionStatus,
  health: ConnectionHealth,
): HealthSummary {
  if (status === 'DISCONNECTED')
    return { state: 'idle', label: 'Not connected', tone: 'neutral', outage: false };
  if (status === 'ERROR' || health.lastSyncStatus === 'failed')
    return { state: 'failed', label: 'Sync failed', tone: 'danger', outage: true };
  if (health.lastWebhookStatus === 'failed')
    return { state: 'retrying', label: 'Retrying', tone: 'warning', outage: true };
  return { state: 'healthy', label: 'Healthy', tone: 'success', outage: false };
}

export function formatRelative(date: Date | null | undefined, now = new Date()): string {
  if (!date) return 'Never';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
