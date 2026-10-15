import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/RouteStates';
import { PageHeader } from '@/components/shell/PageHeader';
import { requireManagerRole } from '@/lib/auth/access';
import { listPricingUnits } from '@/lib/comps/service';

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function RentCompsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [session, query] = await Promise.all([requireManagerRole(), searchParams]);
  const units = await listPricingUnits(session.organizationId);
  const unit = units.find((candidate) => candidate.id === first(query.unit)) ?? units[0];
  if (!unit) return <>
    <PageHeader title="Rent comps" eyebrow="Pricing" />
    <EmptyState title="No units to compare yet" description="Add a property and unit to compare it with nearby rentals." action="Go to properties" href="/properties" />
  </>;

  const filters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'unit' || key === 'tab') continue;
    const singleValue = first(value);
    if (singleValue !== undefined) filters.set(key, singleValue);
  }
  const queryString = filters.size ? `&${filters.toString()}` : '';
  redirect(`/properties/${unit.property.id}/units/${unit.id}?tab=listing${queryString}`);
}
