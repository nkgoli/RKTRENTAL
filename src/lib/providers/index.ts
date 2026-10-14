import { activeIntegration } from '@/lib/integrations/active';
import {
  MockCompsProvider,
  MockPaymentsProvider,
  MockRentometerProvider,
  MockScreeningProvider,
} from './mock';
import { StripeTestPaymentsProvider } from './stripe';
import type { CompsProvider, PaymentsProvider, ScreeningProvider } from './types';

export type ProviderConnectionSettings = {
  accountId?: string;
  webhookEndpointId?: string;
};

function isDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

export async function paymentsProvider(organizationId: string): Promise<PaymentsProvider> {
  const key = process.env.STRIPE_SECRET_KEY;
  const { connection } = await activeIntegration(
    organizationId,
    'payments',
    key?.startsWith('sk_test_') ? ['stripe', 'mock'] : ['mock', 'stripe'],
  );
  if (connection?.provider === 'stripe' && key?.startsWith('sk_test_')) {
    const settings = connection.settings as ProviderConnectionSettings;
    return new StripeTestPaymentsProvider(key, fetch, settings?.accountId);
  }
  if (isDevelopment() && (!connection || connection.provider === 'mock'))
    return new MockPaymentsProvider();
  throw new Error('Payments provider unavailable');
}

export async function screeningProvider(organizationId: string): Promise<ScreeningProvider> {
  const { connection, settings } = await activeIntegration(organizationId, 'screening', [
    'transunion',
    'checkr',
    'mock',
  ]);
  if (
    isDevelopment() &&
    (!connection ||
      connection.provider === 'mock' ||
      connection.provider === 'transunion' ||
      connection.provider === 'checkr')
  )
    return new MockScreeningProvider(settings.defaultPackage);
  throw new Error('Screening provider unavailable');
}

export async function compsProvider(organizationId: string): Promise<CompsProvider> {
  const { connection, settings } = await activeIntegration(organizationId, 'comps', [
    'rentometer',
    'rentrange',
    'mock',
  ]);
  // Comps are public market data with no credentials or money movement, so the keyless sandbox
  // adapter also serves production until a live rent comps adapter is wired in.
  if (connection?.provider === 'rentometer')
    return new MockRentometerProvider(settings.radiusMiles);
  return new MockCompsProvider(settings.radiusMiles);
}

export type {
  PaymentsProvider,
  ScreeningProvider,
  CompsProvider,
  Comparable,
  CompsSearch,
  CompStatus,
} from './types';
