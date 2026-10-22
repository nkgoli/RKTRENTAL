import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/app/(manager)/properties/_components/PropertyForm', () => ({
  ArchiveButton: () => null,
}));
vi.mock('@/components/workspace/InlineFacts', () => ({
  PropertyFactsCard: () => null,
  UnitFactsCard: () => null,
}));
vi.mock('@/app/(manager)/properties/_components/AddUnitDialog', () => ({
  AddUnitDialog: () => null,
}));
vi.mock('@/components/units/DeleteUnitControl', () => ({ DeleteUnitControl: () => null }));
import { PaymentsSummary } from '@/components/workspace/WorkspaceOverview';

describe('overdue overview entry', () => {
  it('shows older arrears separately even when the current month is paid', () => {
    const html = renderToStaticMarkup(
      <PaymentsSummary
        href="/properties/property/payments?unit=unit"
        reminderHref="/notifications?propertyId=property&unitId=unit"
        payments={{
          dueCents: 100000,
          paidCents: 100000,
          outstandingCents: 0,
          lateCount: 0,
          hasCharges: true,
          overdue: { amountCents: 85000, leaseCount: 2 },
        }}
      />,
    );
    expect(html).toContain('all paid');
    expect(html).toContain('100% collected');
    expect(html).toContain('role="meter"');
    expect(html).toContain('$850 overdue');
    expect(html).toContain('includes older arrears and assessed fees');
    expect(html).toContain('href="/notifications?propertyId=property&amp;unitId=unit"');
    expect(html).toContain('Reminder history');
    expect(html).toContain('Send payment reminder');
  });
  it('keeps history available with no overdue balances and no monthly charges', () => {
    const html = renderToStaticMarkup(
      <PaymentsSummary
        href="/payments"
        reminderHref="/notifications?propertyId=property"
        payments={{
          dueCents: 0,
          paidCents: 0,
          outstandingCents: 0,
          lateCount: 0,
          hasCharges: false,
          overdue: { amountCents: 0, leaseCount: 0 },
        }}
      />,
    );
    expect(html).toContain('No rent charges due this month');
    expect(html).toContain('no overdue balance');
    expect(html).toContain('View payments');
    expect(html).toContain('Reminder history');
    expect(html).not.toContain('Send payment reminder');
  });
});
