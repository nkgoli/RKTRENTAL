import { describe, expect, it } from 'vitest';
import { providerActivityAt, providerSyncState } from '@/components/integrations/sync-state';

const provider = {
  connected: true,
  mode: 'live' as const,
  health: { state: 'healthy' as const, label: 'Healthy', tone: 'success' as const, outage: false },
  lastSyncAt: null,
  details: {},
};

describe('provider status presentation', () => {
  it('does not imply a sync from configuration alone', () => {
    expect(providerSyncState(provider)).toEqual({
      label: 'Awaiting activity',
      tone: 'neutral',
      recorded: false,
    });
  });
  it('keeps sandbox activity out of live-sync totals', () => {
    expect(providerSyncState({ ...provider, mode: 'mock', lastSyncAt: new Date() }).recorded).toBe(
      false,
    );
  });
  it('surfaces failures and retrying even in sandbox mode', () => {
    expect(
      providerSyncState({
        ...provider,
        mode: 'mock',
        health: { state: 'retrying', label: 'Retrying', tone: 'warning', outage: true },
      }).label,
    ).toBe('Retrying');
  });
  it('recognizes recorded webhook and sync updates', () => {
    expect(
      providerSyncState({ ...provider, details: { lastWebhookAt: '2026-10-18T00:00:00Z' } })
        .recorded,
    ).toBe(true);
    expect(providerSyncState({ ...provider, lastSyncAt: new Date() }).recorded).toBe(true);
  });
  it('does not treat a disconnected provider as syncing', () => {
    expect(providerSyncState({ ...provider, connected: false, lastSyncAt: new Date() }).label).toBe(
      'Not connected',
    );
  });
  it('uses the latest valid timestamp without treating setup as live health', () => {
    const data = {
      ...provider,
      lastSyncAt: new Date('2026-10-01T00:00:00Z'),
      details: { lastWebhookAt: '2026-10-18T00:00:00Z', lastSyncAt: 'invalid' },
    };
    expect(providerActivityAt(data)?.toISOString()).toBe('2026-10-18T00:00:00.000Z');
    expect(providerSyncState(data)).toMatchObject({ label: 'Activity recorded', tone: 'neutral' });
    expect(providerActivityAt({ lastSyncAt: null, details: { lastSyncAt: 'invalid' } })).toBeNull();
  });
});
