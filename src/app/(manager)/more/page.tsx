import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { managerNav } from '@/components/shell/nav';
import { requireManagerRole } from '@/lib/auth/access';
import { signOutAction } from '@/app/(auth)/sign-out/actions';

/** One line under each section, saying what is found there without repeating live counts. */
const descriptions: Record<string, string> = {
  '/dashboard': 'Rent collection and what needs you today',
  '/properties': 'Properties, units and occupancy',
  '/tenants': 'Tenant directory and balances',
  '/applications': 'Applications, screening and invitations',
  '/leases': 'Active leases, drafts and renewals',
  '/payments': 'Rent roll, ledgers and reminders',
  '/maintenance': 'Repair requests, vendors and status',
  '/documents': 'Lease and property files and photos',
  '/roi-analysis': 'Projections beside property actuals',
  '/rent-analysis': 'Unit rent against nearby comps',
};

export default async function MorePage() {
  await requireManagerRole();
  const groups = managerNav
    .filter((group) => !group.pinned)
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) }))
    .filter((group) => group.items.length);
  return (
    <>
      <PageHeader eyebrow="Menu" title="All sections" meta="Every part of your workspace" />
      <div className="more-sections">
        {groups.map((group) => (
          <section className="card" key={group.label} aria-labelledby={`more-${group.label}`}>
            <h2 className="eyebrow" id={`more-${group.label}`}>
              {group.label}
            </h2>
            <ul className="more-list">
              {group.items.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>
                    <Icon name={item.icon} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{descriptions[item.href]}</small>
                    </span>
                    <Icon name="chevron-right" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="card" aria-labelledby="more-account">
          <h2 className="eyebrow" id="more-account">
            Account
          </h2>
          <ul className="more-list">
            <li>
              <a href="/notifications">
                <Icon name="bell" />
                <span>
                  <strong>Notifications</strong>
                  <small>Reminders, signatures and payment updates</small>
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
            <li>
              <a href="/integrations">
                <Icon name="integrations" />
                <span>
                  <strong>Integrations</strong>
                  <small>Owner payout setup is coming soon</small>
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
            <li>
              <form action={signOutAction}>
                <button type="submit">
                  <Icon name="sign-out" />
                  <span>
                    <strong>Sign out</strong>
                  </span>
                </button>
              </form>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
