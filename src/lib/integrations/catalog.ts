import type { ProviderKind } from '@prisma/client';

export type IntegrationGroup = 'payments' | 'screening' | 'comps';

export type ProviderDefinition = {
  kind: ProviderKind;
  group: IntegrationGroup;
  provider: string;
  name: string;
  logo: string;
  description: string;
  availableText?: string;
  /** Environment variable that holds the provider credential. The value is never read into the UI. */
  credentialEnv: string;
};

export const PROVIDERS: ProviderDefinition[] = [
  {
    kind: 'PAYMENTS',
    group: 'payments',
    provider: 'stripe',
    name: 'Stripe',
    logo: 'S',
    description: 'Card payments · payouts · refunds',
    availableText: 'Collect card payments, send owner payouts and issue refunds.',
    credentialEnv: 'STRIPE_SECRET_KEY',
  },
  {
    kind: 'BANKING',
    group: 'payments',
    provider: 'plaid',
    name: 'Plaid',
    logo: 'P',
    description: 'ACH bank transfer',
    availableText: 'Let tenants pay rent by ACH bank transfer.',
    credentialEnv: 'PLAID_SECRET',
  },
  {
    kind: 'SCREENING',
    group: 'screening',
    provider: 'transunion',
    name: 'TransUnion SmartMove',
    logo: 'TU',
    description: 'Credit · background · eviction',
    availableText: 'Add credit, background and eviction screening for applications.',
    credentialEnv: 'TRANSUNION_API_KEY',
  },
  {
    kind: 'SCREENING',
    group: 'screening',
    provider: 'checkr',
    name: 'Checkr',
    logo: 'C',
    description: 'Background checks',
    availableText: 'Add a second screening option for supported applications.',
    credentialEnv: 'CHECKR_API_KEY',
  },
  {
    kind: 'COMPS',
    group: 'comps',
    provider: 'rentrange',
    name: 'RentRange',
    logo: 'RR',
    description: 'Rental comps · market data',
    availableText: 'Add rental comps and market data for pricing decisions.',
    credentialEnv: 'RENTRANGE_API_KEY',
  },
  {
    kind: 'COMPS',
    group: 'comps',
    provider: 'rentometer',
    name: 'Rentometer',
    logo: 'Rm',
    description: 'Rental estimates · market data',
    availableText: 'Add another source for local rent comparisons.',
    credentialEnv: 'RENTOMETER_API_KEY',
  },
];

export function findProvider(kind: string, provider: string): ProviderDefinition | undefined {
  return PROVIDERS.find((item) => item.kind === kind && item.provider === provider);
}

export function providersFor(group: IntegrationGroup) {
  return PROVIDERS.filter((item) => item.group === group);
}
