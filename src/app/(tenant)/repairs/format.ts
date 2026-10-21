import type { MaintenancePriority } from '@prisma/client';

export const CATEGORIES = ['Plumbing', 'Electrical', 'Heating & cooling', 'Appliance', 'Other'];

export const ENTRY_OPTIONS = {
  key: 'Vendor may enter with manager key',
  home: 'I need to be home — call first',
} as const;
export type EntryChoice = keyof typeof ENTRY_OPTIONS;

export const URGENCY_OPTIONS: { value: MaintenancePriority; label: string }[] = [
  { value: 'NORMAL', label: 'Normal — within a few days' },
  { value: 'LOW', label: 'Low — when convenient' },
  { value: 'HIGH', label: 'Urgent — today if possible' },
  { value: 'URGENT', label: 'Emergency — water / safety risk' },
];

export const MAX_PHOTOS = 5;

/** Maintenance requests have no category or entry columns, so they travel as a description header. */
export function composeDescription(category: string, entry: EntryChoice, text: string) {
  return `Category: ${category}\nEntry permission: ${ENTRY_OPTIONS[entry]}\n\n${text}`;
}

export function parseDescription(description: string | null) {
  const text = (description ?? '').replace(/\r\n/g, '\n');
  const match =
    /^Category:[ \t]*([^\n]*)\n(?:Entry permission:[ \t]*([^\n]*)\n)?\n?([\s\S]*)$/.exec(text);
  if (!match) return { category: 'General', entry: null, text };
  return {
    category: match[1].trim() || 'General',
    entry: match[2]?.trim() || null,
    text: match[3],
  };
}

export function titleFrom(text: string) {
  const line = text.trim().split(/\r?\n/)[0] ?? '';
  const sentence = line.split(/(?<=[.!?])\s/)[0] ?? line;
  return sentence.length > 80 ? `${sentence.slice(0, 77).trimEnd()}…` : sentence;
}
