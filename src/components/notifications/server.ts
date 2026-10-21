import { db } from '@/lib/db/client';
import { ensureRentCharges } from '@/lib/ledger';
import { loadReminderLeases } from '@/lib/workspace/timeline-data';
import type { ScopeFilter } from '@/lib/workspace/scope';
import { reminderTransport, ReminderError } from '@/lib/notifications/reminder-transport';
import { errorMessage, type Channels, type LeaseChoice } from './model';

export async function loadReminderChannels(organizationId: string): Promise<Channels> {
  const entries = await Promise.all(
    (['EMAIL', 'SMS'] as const).map(async (channel) => {
      try {
        const transport = await reminderTransport(organizationId, channel, db);
        return [
          channel,
          transport.name === 'mock'
            ? {
                mode: 'sandbox',
                message: 'Sandbox only. Records a test attempt; no email or text is delivered.',
              }
            : {
                mode: 'live',
                message: 'Configured for sending. Provider acceptance does not confirm delivery.',
              },
        ] as const;
      } catch (e) {
        return [
          channel,
          {
            mode: 'unavailable',
            message: errorMessage(e instanceof ReminderError ? e.code : 'TRANSPORT_UNCONFIGURED'),
          },
        ] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Channels;
}

export async function loadReminderChoices(
  organizationId: string,
  scope: ScopeFilter,
): Promise<LeaseChoice[]> {
  const now = new Date();
  await ensureRentCharges(organizationId, now);
  const rows = await loadReminderLeases(organizationId, scope, now);
  return rows.map(({ lease, EMAIL, SMS }) => ({
    id: lease.id,
    label: `${lease.unit.property.name} · ${lease.unit.isImplicit ? 'Whole property' : `Unit ${lease.unit.number}`} · ${lease.tenants.map(({ tenant }) => tenant.name).join(', ') || 'No tenants'} · ${lease.status.toLowerCase()} lease`,
    tenants: lease.tenants.map(({ tenant }) => ({ id: tenant.id, name: tenant.name })),
    EMAIL,
    SMS,
  }));
}
