// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitSwitcher } from '@/components/workspace/UnitSwitcher';

const nav = vi.hoisted(() => ({ query: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/properties/cedar/returns',
  useSearchParams: () => new URLSearchParams(nav.query),
  useRouter: () => ({ push: nav.push }),
}));

const units = [
  { id: 'u1', number: 'Townhome 1', isImplicit: false, status: 'OCCUPIED' },
  { id: 'u2', number: 'Townhome 2', isImplicit: false, status: 'VACANT' },
];

afterEach(() => {
  cleanup();
  nav.push.mockReset();
  nav.query = '';
});

describe('unit switch report filters', () => {
  it.each([
    {
      direction: 'all units to a unit',
      query: 'period=CUSTOM&from=2026-01&to=2026-06&notice=saved&created=1',
      selection: 'u1',
      expected: 'period=CUSTOM&from=2026-01&to=2026-06&unit=u1',
    },
    {
      direction: 'unit to all units',
      query: 'unit=u1&period=CUSTOM&from=2026-01&to=2026-06&notice=saved&created=1',
      selection: '',
      expected: 'period=CUSTOM&from=2026-01&to=2026-06',
    },
    {
      direction: 'one unit to another with a preset',
      query: 'unit=u1&period=YTD&notice=saved',
      selection: 'u2',
      expected: 'period=YTD&unit=u2',
    },
    {
      direction: 'all units to a unit without filters',
      query: 'notice=saved&created=1',
      selection: 'u2',
      expected: 'unit=u2',
    },
  ])(
    'preserves supported filters and drops transient flags: $direction',
    async ({ query, selection, expected }) => {
      nav.query = query;
      const user = userEvent.setup();
      render(<UnitSwitcher propertyName="Cedar Row" units={units} />);
      await user.selectOptions(screen.getByRole('combobox', { name: 'Switch unit' }), selection);
      expect(nav.push).toHaveBeenCalledWith(`/properties/cedar/returns?${expected}`);
    },
  );
});
