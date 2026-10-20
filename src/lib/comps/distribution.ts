/**
 * RealROI Search "Rental Distribution" (C25): a normal curve with the comps'
 * mean and population standard deviation, normalised so its peak is 100.
 * The subject's rent is plotted on the curve but excluded from the statistics,
 * so it is compared with the market rather than averaged into it.
 */
export function rentDistribution(rents: number[], subjectRent: number | null) {
  const comps = rents.filter((r) => Number.isFinite(r) && r > 0);
  if (!comps.length) return null;
  const mean = comps.reduce((a, b) => a + b, 0) / comps.length;
  const low = Math.min(...comps);
  const high = Math.max(...comps);
  const variance = comps.reduce((sum, r) => sum + (r - mean) ** 2, 0) / comps.length;
  const sd = Math.sqrt(variance) || (high - low) * 0.2 || mean * 0.1;
  const span = sd * 2.5;
  const subject = subjectRent != null && subjectRent > 0 ? subjectRent : null;
  const min = Math.max(0, Math.min(mean - span, subject ?? Infinity, low));
  const max = Math.max(mean + span, subject ?? 0, high);
  const density = (r: number) => 100 * Math.exp(-0.5 * ((r - mean) / sd) ** 2);
  const steps = 60;
  const curve = Array.from({ length: steps + 1 }, (_, i) => {
    const rent = min + ((max - min) * i) / steps;
    return { rent, density: density(rent) };
  });
  return {
    mean,
    sd,
    low,
    high,
    min,
    max,
    curve,
    comps: comps.map((rent) => ({ rent, density: density(rent) })),
    subject: subject == null ? null : { rent: subject, density: density(subject) },
  };
}
