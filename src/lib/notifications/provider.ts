import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { isSandboxEnabled } from '@/lib/providers/sandbox';
import type { EmailMessage } from './messages';

export interface EmailProvider {
  readonly name: string;
  /** True only when a new delivery was recorded. */
  send(message: EmailMessage): Promise<boolean>;
}

/** A durable mock/sandbox adapter: the outbox row is the send and the unique key is its guard. */
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  constructor(private readonly client: PrismaClient = db) {}

  async send(message: EmailMessage): Promise<boolean> {
    try {
      await this.client.emailDelivery.create({ data: { ...message, provider: this.name } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return false;
      throw error;
    }
  }
}

/** Mirrors the connected-provider lookup: no live email credentials or transport is installed. */
export async function emailProvider(
  organizationId: string,
  client: PrismaClient = db,
): Promise<EmailProvider> {
  const rows = await client.providerConnection.findMany({
    where: { organizationId, kind: 'EMAIL' },
  });
  const connection = rows.find((row) => row.status === 'CONNECTED' && row.provider !== 'settings');
  const settings = rows.find((row) => row.provider === 'settings')?.settings;
  const mode =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>).mode
      : undefined;
  if (
    connection?.provider === 'mock' &&
    isSandboxEnabled() &&
    (mode === undefined || mode === 'mock' || mode === 'sandbox')
  )
    return new MockEmailProvider(client);
  if (!connection && isSandboxEnabled()) return new MockEmailProvider(client);
  throw new Error(
    'Email provider unavailable; connect the mock email provider for sandbox delivery',
  );
}
