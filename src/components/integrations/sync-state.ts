import type { ProviderView } from '@/lib/integrations/service';

export function providerActivityAt(provider: Pick<ProviderView, 'lastSyncAt' | 'details'>) {
  const times = [
    provider.lastSyncAt?.getTime(),
    Date.parse(provider.details.lastWebhookAt ?? ''),
    Date.parse(provider.details.lastSyncAt ?? ''),
  ].filter((time): time is number => typeof time === 'number' && Number.isFinite(time));
  return times.length ? new Date(Math.max(...times)) : null;
}

/** Configuration, sandbox mode and reported sync outcomes are distinct states. */
export function providerSyncState(
  provider: Pick<ProviderView, 'connected' | 'mode' | 'health' | 'lastSyncAt' | 'details'>,
) {
  if (!provider.connected)
    return { label: 'Not connected', tone: 'neutral' as const, recorded: false };
  const recorded = provider.mode !== 'mock' && providerActivityAt(provider) !== null;
  if (provider.health.outage)
    return { label: provider.health.label, tone: provider.health.tone, recorded };
  if (provider.mode === 'mock')
    return { label: 'Sandbox · no live sync', tone: 'neutral' as const, recorded: false };
  return {
    label: recorded ? 'Activity recorded' : 'Awaiting activity',
    tone: 'neutral' as const,
    recorded,
  };
}
