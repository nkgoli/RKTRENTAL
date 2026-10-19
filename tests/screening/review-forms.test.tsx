// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewDecisionForm } from '@/app/(manager)/applications/ReviewForms';

afterEach(cleanup);
describe('review decision controls', () => {
  it('requires the matching reason and submits the retained application/property/unit context', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (data: FormData) => {
      expect(data.get('applicationId')).toBe('app-1');
    });
    render(
      <ReviewDecisionForm action={action} applicationId="app-1" propertyId="maple" unitId="4b" />,
    );
    const approve = screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
    const decline = screen.getByRole('button', { name: 'Decline' }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(decline.disabled).toBe(true);
    await user.selectOptions(screen.getByRole('combobox'), 'credit-below-criteria');
    expect(approve.disabled).toBe(true);
    expect(decline.disabled).toBe(false);
    await user.selectOptions(screen.getByRole('combobox'), 'criteria-met');
    expect(approve.disabled).toBe(false);
    expect(decline.disabled).toBe(true);
    await user.click(approve);
    const submitted = action.mock.calls[0][0];
    expect(Object.fromEntries(submitted)).toMatchObject({
      applicationId: 'app-1',
      propertyId: 'maple',
      unitId: '4b',
      decision: 'APPROVED',
      reason: 'criteria-met',
    });
  });
});
