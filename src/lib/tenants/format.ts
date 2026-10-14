const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(value: number | string | { toString(): string }): string {
  return money.format(Number(value.toString()));
}

export function toCents(value: number | string | { toString(): string }): number {
  return Math.round(Number(value.toString()) * 100);
}

/** Dates are stored as UTC calendar dates; render them without timezone drift. */
export function formatDate(value: Date | null | undefined): string {
  if (!value) return '—';
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function toInputDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function formatBytes(value: bigint | number): string {
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** One year after `start`, minus a day (a standard 12-month lease term). */
export function defaultLeaseEnd(start: Date): Date {
  const end = new Date(
    Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1),
  );
  return end;
}
