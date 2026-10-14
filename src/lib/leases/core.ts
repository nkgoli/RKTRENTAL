export type LeaseWindow = { startDate: Date; endDate: Date };

/** Lease dates are inclusive in the database. Adjacent terms do not overlap. */
export function overlaps(a: LeaseWindow, b: LeaseWindow): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function nextLeaseStart(endDate: Date): Date {
  return new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() + 1),
  );
}

export function renewalEnd(startDate: Date): Date {
  return new Date(
    Date.UTC(startDate.getUTCFullYear() + 1, startDate.getUTCMonth(), startDate.getUTCDate() - 1),
  );
}

export function terminationEnd(lease: LeaseWindow, today: Date): Date {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return new Date(
    Math.max(lease.startDate.getTime(), Math.min(lease.endDate.getTime(), day.getTime())),
  );
}

export function parseLeaseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseMoney(value: string): string | null {
  const match = /^(?:\$)?(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim().replaceAll(',', ''));
  if (!match) return null;
  return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
}

export function parseTerms(form: FormData) {
  const errors: Record<string, string> = {};
  const startDate = parseLeaseDate(String(form.get('startDate') ?? ''));
  const endDate = parseLeaseDate(String(form.get('endDate') ?? ''));
  const monthlyRent = parseMoney(String(form.get('monthlyRent') ?? ''));
  const deposit = parseMoney(String(form.get('deposit') ?? ''));
  const lateFee = parseMoney(String(form.get('lateFee') ?? '0'));
  const graceDays = Number(form.get('graceDays') ?? 0);
  if (!startDate) errors.startDate = 'Enter a valid start date.';
  if (!endDate) errors.endDate = 'Enter a valid end date.';
  if (startDate && endDate && endDate < startDate)
    errors.endDate = 'End date must be on or after start date.';
  if (!monthlyRent || Number(monthlyRent) <= 0)
    errors.monthlyRent = 'Enter a monthly rent greater than zero.';
  if (!deposit) errors.deposit = 'Enter a valid deposit.';
  if (!lateFee) errors.lateFee = 'Enter a valid late fee.';
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 31)
    errors.graceDays = 'Enter 0 to 31 days.';
  if (
    Object.keys(errors).length ||
    !startDate ||
    !endDate ||
    !monthlyRent ||
    !deposit ||
    !lateFee
  ) {
    return { ok: false as const, errors };
  }
  return {
    ok: true as const,
    data: { startDate, endDate, monthlyRent, deposit, lateFee, graceDays },
  };
}
