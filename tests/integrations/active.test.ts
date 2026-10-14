import { describe, expect, it } from 'vitest';
import { activeIntegration } from '../../src/lib/integrations/active';

describe('active integration lookup', () => {
  it('ignores the pseudo settings connection and loads its group settings', async () => {
    const result = await activeIntegration(
      'org-1',
      'comps',
      ['rentometer', 'rentrange'],
      async () => [
        {
          kind: 'COMPS',
          provider: 'settings',
          status: 'DISCONNECTED',
          settings: { radiusMiles: 3, refresh: 'weekly' },
        },
        { kind: 'COMPS', provider: 'rentrange', status: 'CONNECTED', settings: { mode: 'mock' } },
        { kind: 'COMPS', provider: 'rentometer', status: 'CONNECTED', settings: { mode: 'mock' } },
      ],
    );
    expect(result.connection?.provider).toBe('rentometer');
    expect(result.settings).toEqual({ radiusMiles: 3, refresh: 'weekly' });
  });
});
