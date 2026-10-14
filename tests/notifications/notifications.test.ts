import { describe, expect, it } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  rentMessages,
  renewalMessages,
  repairMessages,
  type EmailMessage,
} from '@/lib/notifications/messages';
import { MockEmailProvider } from '@/lib/notifications/provider';
import { sendMessages } from '@/lib/notifications/service';

const now = new Date('2026-10-14T12:00:00Z');
const tenants = [
  {
    name: 'Alex Rivera',
    email: 'Alex@example.com',
    user: { email: 'Alex@example.com', emailNotificationsEnabled: true },
  },
  {
    name: 'No Mail',
    email: 'optout@example.com',
    user: { email: 'optout@example.com', emailNotificationsEnabled: false },
  },
];

function outbox() {
  const sent: EmailMessage[] = [];
  const client = {
    emailDelivery: {
      create: async ({ data }: { data: EmailMessage }) => {
        if (
          sent.some(
            (item) =>
              item.organizationId === data.organizationId &&
              item.eventKey === data.eventKey &&
              item.recipient === data.recipient,
          )
        )
          throw new Prisma.PrismaClientKnownRequestError('Unique delivery key', {
            code: 'P2002',
            clientVersion: '6.19.3',
          });
        sent.push(data);
        return data;
      },
    },
  } as unknown as PrismaClient;
  return { sent, provider: new MockEmailProvider(client) };
}

const rentInput = {
  organizationId: 'org-1',
  leaseId: 'lease-1',
  propertyName: 'Maple Court',
  unitNumber: '2B',
  graceDays: 3,
  tenants,
  payments: [],
  now,
};

describe('notification triggers and mock outbox', () => {
  it('records one of each email kind for a seeded notification scenario', async () => {
    const { sent, provider } = outbox();
    const messages = [
      ...rentMessages({
        ...rentInput,
        charges: [
          {
            id: 'seed-due',
            leaseId: 'lease-1',
            kind: 'RENT',
            amountCents: 125000,
            dueDate: new Date('2026-10-16T00:00:00Z'),
          },
          {
            id: 'seed-late',
            leaseId: 'lease-1',
            kind: 'RENT',
            amountCents: 125000,
            dueDate: new Date('2026-10-01T00:00:00Z'),
          },
        ],
      }),
      ...renewalMessages({
        organizationId: 'org-1',
        leaseId: 'lease-1',
        propertyName: 'Maple Court',
        unitNumber: '2B',
        endDate: new Date('2026-11-01T00:00:00Z'),
        tenants,
        now,
      }),
      ...repairMessages({
        organizationId: 'org-1',
        eventId: 'seed-repair',
        title: 'Leaking tap',
        status: 'IN_PROGRESS',
        tenants,
      }),
    ];
    expect(await sendMessages(messages, provider)).toBe(4);
    expect(sent.map((message) => message.kind).sort()).toEqual(
      ['LEASE_RENEWAL', 'RENT_DUE', 'RENT_LATE', 'REPAIR_UPDATE'].sort(),
    );
    console.log(
      'Seeded mock outbox:',
      sent.map(({ kind, recipient }) => `${kind} -> ${recipient}`).join(', '),
    );
  });

  it('sends rent due soon once to the opted-in tenant', async () => {
    const messages = rentMessages({
      ...rentInput,
      charges: [
        {
          id: 'charge-due',
          leaseId: 'lease-1',
          kind: 'RENT',
          amountCents: 125000,
          dueDate: new Date('2026-10-16T00:00:00Z'),
        },
      ],
    });
    const { sent, provider } = outbox();
    expect(await sendMessages(messages, provider)).toBe(1);
    expect(await sendMessages(messages, provider)).toBe(0);
    expect(sent).toMatchObject([
      { kind: 'RENT_DUE', recipient: 'alex@example.com', subject: 'Rent due soon for Maple Court' },
    ]);
    expect(sent[0].body).toContain('$1,250');
  });

  it('sends a late reminder for unpaid rent, but not for paid rent', async () => {
    const charges = [
      {
        id: 'charge-late',
        leaseId: 'lease-1',
        kind: 'RENT' as const,
        amountCents: 125000,
        dueDate: new Date('2026-10-01T00:00:00Z'),
      },
    ];
    const { sent, provider } = outbox();
    expect(await sendMessages(rentMessages({ ...rentInput, charges }), provider)).toBe(1);
    expect(sent[0]).toMatchObject({ kind: 'RENT_LATE', recipient: 'alex@example.com' });
    expect(sent[0].body).toContain('rent is late');
    expect(
      rentMessages({
        ...rentInput,
        charges,
        payments: [{ leaseId: 'lease-1', amountCents: 125000, status: 'SUCCEEDED' }],
      }),
    ).toEqual([]);
  });

  it('sends lease renewal notice only inside the 30-day window', async () => {
    const input = {
      organizationId: 'org-1',
      leaseId: 'lease-1',
      propertyName: 'Maple Court',
      unitNumber: '2B',
      endDate: new Date('2026-11-01T00:00:00Z'),
      tenants,
      now,
    };
    const { sent, provider } = outbox();
    expect(await sendMessages(renewalMessages(input), provider)).toBe(1);
    expect(sent[0]).toMatchObject({ kind: 'LEASE_RENEWAL', recipient: 'alex@example.com' });
    expect(sent[0].body).toContain('2026-11-01');
    expect(renewalMessages({ ...input, endDate: new Date('2026-12-01T00:00:00Z') })).toEqual([]);
  });

  it('sends a repair update once per status event', async () => {
    const { sent, provider } = outbox();
    const messages = repairMessages({
      organizationId: 'org-1',
      eventId: 'event-1',
      title: 'Leaking tap',
      status: 'IN_PROGRESS',
      tenants,
    });
    expect(await sendMessages(messages, provider)).toBe(1);
    expect(await sendMessages(messages, provider)).toBe(0);
    expect(sent[0]).toMatchObject({ kind: 'REPAIR_UPDATE', recipient: 'alex@example.com' });
    expect(sent[0].body).toContain('in progress');
  });
});
