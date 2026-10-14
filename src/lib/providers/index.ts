import { db } from '@/lib/db/client';
import { MockCompsProvider, MockPaymentsProvider, MockScreeningProvider } from './mock';
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
  const connections = await db.providerConnection.findMany({
    where: { organizationId, kind: 'PAYMENTS', status: 'CONNECTED' },
  });
  const stripe = connections.find((connection) => connection.provider === 'stripe');
  const key = process.env.STRIPE_SECRET_KEY;
  if (stripe && key?.startsWith('sk_test_')) {
    const settings = stripe.settings as ProviderConnectionSettings;
    return new StripeTestPaymentsProvider(key, fetch, settings.accountId);
  }
  if (
    isDevelopment() &&
    (connections.length === 0 || connections.some((connection) => connection.provider === 'mock'))
  )
    return new MockPaymentsProvider();
  throw new Error('Payments provider unavailable');
}

export async function screeningProvider(organizationId: string): Promise<ScreeningProvider> {
  const connection = await db.providerConnection.findFirst({
    where: { organizationId, kind: 'SCREENING', status: 'CONNECTED' },
  });
  if (
    isDevelopment() &&
    (!connection || connection.provider === 'mock' || connection.provider === 'transunion')
  )
    return new MockScreeningProvider();
  throw new Error('Screening provider unavailable');
}

export async function compsProvider(organizationId: string): Promise<CompsProvider> {
  const connection = await db.providerConnection.findFirst({
    where: { organizationId, kind: 'COMPS', status: 'CONNECTED' },
  });
  if (
    isDevelopment() &&
    (!connection || connection.provider === 'mock' || connection.provider === 'rentrange')
  )
    return new MockCompsProvider();
  throw new Error('Comps provider unavailable');
}

export type { PaymentsProvider, ScreeningProvider, CompsProvider } from './types';
