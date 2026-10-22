'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import type { ManagerAction } from '@/components/shell/nav';

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

function partOfDay(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home's greeting and date use the viewer's own clock, so they are set after hydration;
 * the server render says "Welcome back" with no date.
 */
export function HomeHeader({
  firstName,
  propertyCount,
  unitCount,
  needsCount,
  actions,
}: {
  firstName: string;
  propertyCount: number;
  unitCount: number;
  needsCount: number;
  actions: ManagerAction[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const greeting = now ? partOfDay(now.getHours()) : 'Welcome back';
  const date = now
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : null;
  const needs = needsCount
    ? `${plural(needsCount, 'thing')} ${needsCount === 1 ? 'needs' : 'need'} you today`
    : 'Nothing needs you today';
  const meta = [
    date,
    plural(propertyCount, 'property', 'properties'),
    plural(unitCount, 'unit'),
    needs,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PageHeader
      eyebrow="Home"
      title={firstName ? `${greeting}, ${firstName}` : greeting}
      meta={meta}
      actions={actions}
    />
  );
}
