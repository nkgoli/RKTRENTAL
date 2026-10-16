import { requireManagerRole } from '@/lib/auth/access';
import {
  buildReturnsCsv,
  loadReturnsOverview,
  resolveReturnsPeriod,
} from '@/lib/returns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await requireManagerRole();
  const url = new URL(request.url);
  const period = await resolveReturnsPeriod(
    session.organizationId,
    {
      period: url.searchParams.get('period'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    },
    new Date(),
  );
  const periodKey = period.key;
  const overview = await loadReturnsOverview(session.organizationId, period);
  const propertyId = url.searchParams.get('property');
  const rows = propertyId
    ? overview.properties.filter((p) => p.propertyId === propertyId)
    : overview.properties;
  const csv = buildReturnsCsv(
    rows.map((r) => ({ propertyName: r.propertyName, metrics: r.metrics })),
    propertyId
      ? null
      : overview.portfolio
        ? { propertyName: 'Portfolio', metrics: overview.portfolio.metrics }
        : null,
    `${periodKey} · ${period.label}`,
  );
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="returns-${periodKey.toLowerCase()}.csv"`,
    },
  });
}
