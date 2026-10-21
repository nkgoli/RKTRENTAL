// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewDecisionForm } from '@/app/(manager)/applications/ReviewForms';

afterEach(cleanup);
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
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

  it.each([
    'credit-below-criteria',
    'background-review',
    'eviction-review',
    'application-incomplete',
  ])('allows only decline for %s and exposes the full selected label', async (reason) => {
    const user = userEvent.setup();
    const action = vi.fn(async (data: FormData) => {
      expect(data.get('applicationId')).toBe('app-2');
    });
    render(<ReviewDecisionForm action={action} applicationId="app-2" />);
    await user.selectOptions(screen.getByRole('combobox'), reason);
    const selected = (screen.getByRole('combobox') as HTMLSelectElement).selectedOptions[0].text;
    expect(screen.getByText(selected, { selector: 'small' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(action).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Decline this application?' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(within(dialog).getByRole('button', { name: 'Decline application' }));
    expect(Object.fromEntries(action.mock.calls[0][0])).toMatchObject({
      applicationId: 'app-2',
      decision: 'DECLINED',
      reason,
    });
  });
});
