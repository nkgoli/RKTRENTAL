import { describe, expect, it } from 'vitest';
import { findManagerItem, managerNav } from '@/components/shell/nav';

describe('tenant navigation is applicant-led', () => {
  it('points the Tenants shortcut at Applications instead of manual creation', () => {
    expect(findManagerItem('/tenants')?.item.actions).toEqual([
      { label: 'Review applications', href: '/applications', primary: true, icon: 'arrow-right' },
    ]);
  });

  it('exposes no standalone add-tenant link anywhere in the shell', () => {
    const actions = managerNav.flatMap((g) => g.items).flatMap((i) => i.actions ?? []);
    expect(
      actions.filter((a) => /add tenant|\/tenants\?add/i.test(`${a.label} ${a.href}`)),
    ).toEqual([]);
  });
});
