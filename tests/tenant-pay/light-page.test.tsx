import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/access', () => ({
  requireTenantRole: async () => ({ tenantId: 'own', organizationId: 'org', name: 'Live tenant' }),
}));
vi.mock('@/lib/tenant-pay', async (original) => ({
  ...(await original<typeof import('@/lib/tenant-pay')>()),
  loadTenantPayView: load,
}));
vi.mock('@/app/(tenant)/pay/PayForm', () => ({
  PayForm: ({ totalDueCents }: { totalDueCents: number }) => <p>Source amount {totalDueCents}</p>,
  AddPaymentMethods: () => <p>Add methods</p>,
}));
vi.mock('@/app/(tenant)/pay/AutopayToggle', () => ({ AutopayToggle: () => <p>Autopay</p> }));
import Pay from '@/app/(tenant)/pay/page';

const fixture = () => ({
  leaseId: 'fixture',
  propertyName: 'Source property',
  unitLabel: '7',
  monthlyRentCents: 231047,
  rentDueDay: 1,
  graceDays: 5,
  passFees: false,
  methods: [],
  autopay: { enabled: false },
  amountDue: {
    dueDate: new Date('2026-11-01'),
    totalDueCents: 181047,
    pendingCents: 25000,
    lines: [{ label: 'November rent', paidCents: 50000, outstandingCents: 181047 }],
  },
  receipts: ['SUCCEEDED', 'PENDING', 'FAILED', 'REFUNDED'].map((status, i) => ({
    paymentId: String(i),
    label: `Source receipt ${i}`,
    date: new Date('2026-10-03'),
    amountCents: 50000,
    status,
    statusLabel: ['Paid', 'Pending', 'Failed', 'Refunded'][i],
  })),
});

it('renders source amounts, partial balance, pending funds and readable receipt outcomes', async () => {
  load.mockResolvedValue(fixture());
  const html = renderToStaticMarkup(
    await Pay({ searchParams: Promise.resolve({ notice: 'payment-duplicate' }) }),
  );
  for (const value of [
    'Source property',
    '181047',
    '$1,810.47',
    '$500 already paid',
    '$250 is on its way',
    'Paid',
    'Pending',
    'Failed',
    'Refunded',
    'That payment was already recorded.',
    '/lease',
  ])
    expect(html).toContain(value);
  expect(html).not.toContain('$1,850');
  expect(html).not.toContain('Design reference');
});

it('keeps no-active-lease recovery and all-paid method setup', async () => {
  load.mockResolvedValue(null);
  expect(renderToStaticMarkup(await Pay({ searchParams: Promise.resolve({}) }))).toContain(
    'Check again',
  );
  const view = fixture();
  view.amountDue.lines = [];
  view.amountDue.totalDueCents = 0;
  view.receipts = [];
  load.mockResolvedValue(view);
  const html = renderToStaticMarkup(await Pay({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('all paid up');
  expect(html).toContain('Add methods');
  expect(html).toContain('Your receipts will appear here');
});
