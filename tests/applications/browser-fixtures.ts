/** Synthetic fixtures for configured-browser checks. Never run against a shared or live database. */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createInvitation } from '@/lib/applications/invitations';
import { invitationLink } from '@/lib/applications/invitation-policy';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.APPLICATION_INVITATION_TEST_FIXTURES !== '1' ||
    process.env.ROCKETRENTAL_SANDBOX !== 'true' ||
    !['localhost', '127.0.0.1'].includes(url.hostname)
  )
    throw new Error('Explicit isolated local sandbox required.');
  const client = new PrismaClient();
  const organizationId = 'seed-rocket-rental';
  const actor = { organizationId, subjectId: 'seed-user-jordan', role: 'MANAGER' as const };
  try {
    if (process.argv[2] === 'prepare') {
      for (const kind of ['expired', 'unavailable']) {
        const row = await createInvitation(
          actor,
          {
            fullName: `Synthetic ${kind} Applicant`,
            email: `invitation.${kind}@example.test`,
            propertyId: 'seed-property-maple',
            unitId: 'seed-unit-maple-7',
            requestKey: randomUUID(),
          },
          client,
        );
        if (kind === 'expired')
          await client.applicationInvitation.update({
            where: { id: row.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
        console.log(JSON.stringify({ kind, id: row.id, link: invitationLink(row.tokenCipher) }));
      }
    } else if (process.argv[2] === 'block-email') {
      await client.providerConnection.upsert({
        where: {
          organizationId_kind_provider: { organizationId, kind: 'EMAIL', provider: 'smtp' },
        },
        update: { status: 'CONNECTED' },
        create: {
          id: 'invitation-browser-smtp-block',
          organizationId,
          kind: 'EMAIL',
          provider: 'smtp',
          status: 'CONNECTED',
        },
      });
      console.log(
        'Synthetic live-provider metadata added; sandbox transport must refuse dispatch.',
      );
    } else if (process.argv[2] === 'restore-email') {
      await client.providerConnection.deleteMany({
        where: { id: 'invitation-browser-smtp-block', organizationId },
      });
      console.log('Synthetic provider metadata removed.');
    } else if (process.argv[2] === 'evidence') {
      const rows = await client.applicationInvitation.findMany({
        where: {
          organizationId,
          applicantEmail: {
            in: ['invitation.desktop@example.test', 'invitation.mobile@example.test'],
          },
        },
        include: { application: { include: { consents: true, reports: true } }, attempts: true },
      });
      console.log(
        JSON.stringify(
          rows.map((row) => ({
            email: row.applicantEmail,
            submitted: Boolean(row.submittedAt),
            applications: row.application ? 1 : 0,
            status: row.application?.status,
            consentCount: row.application?.consents.length,
            reportCount: row.application?.reports.length,
            attempts: row.attempts.map((a) => a.status),
          })),
          null,
          2,
        ),
      );
    } else throw new Error('Use prepare, block-email, restore-email or evidence.');
  } finally {
    await client.$disconnect();
  }
}
void main();
