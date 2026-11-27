import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import { managerNav } from '@/components/shell/nav';
import { requireManagerRole } from '@/lib/auth/access';
import { signOutAction } from '@/app/(auth)/sign-out/actions';

/** A few words under each section, without repeating live counts. */
const descriptions: Record<string, string> = {
  '/dashboard': 'Collection and today’s tasks',
  '/properties': 'Units and occupancy',
  '/tenants': 'Tenants and balances',
  '/applications': 'Screening and invitations',
  '/leases': 'Agreements and renewals',
  '/payments': 'Rent roll and ledgers',
  '/maintenance': 'Repairs and vendors',
  '/documents': 'Files and photos',
  '/roi-analysis': 'Projections vs actuals',
  '/rent-analysis': 'Rent vs nearby comps',
};

export default async function MorePage() {
  await requireManagerRole();
  const groups = managerNav
    .filter((group) => !group.pinned)
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden) }))
    .filter((group) => group.items.length);
  return (
    <>
      <PageHeader title="All sections" />
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
                  <small>Reminders and updates</small>
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
            <li>
              <a href="/integrations">
                <Icon name="integrations" />
                <span>
                  <strong>Integrations</strong>
                  <small>Owner payouts coming soon</small>
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
