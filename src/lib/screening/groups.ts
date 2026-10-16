import type { ApplicationStatus, Prisma } from '@prisma/client';

/** Which status speaks for a household: the furthest-along application wins. */
export const GROUP_STATUS_RANK: ApplicationStatus[] = ['APPROVED', 'REVIEW', 'SCREENING', 'SUBMITTED', 'DECLINED'];

export function groupStatus(statuses: ApplicationStatus[]): ApplicationStatus {
  return GROUP_STATUS_RANK.find((status) => statuses.includes(status)) ?? 'SUBMITTED';
}

type GroupClient = Pick<Prisma.TransactionClient, 'application' | 'applicationGroup'>;

/** Recomputes an application's household status after one of its applications changed. */
export async function syncApplicationGroupStatus(client: GroupClient, applicationId: string) {
  const application = await client.application.findUnique({
    where: { id: applicationId }, select: { applicationGroupId: true, organizationId: true },
  });
  if (!application?.applicationGroupId) return;
  const members = await client.application.findMany({
    where: { applicationGroupId: application.applicationGroupId, organizationId: application.organizationId },
    select: { status: true },
  });
  await client.applicationGroup.updateMany({
    where: { id: application.applicationGroupId, organizationId: application.organizationId },
    data: { status: groupStatus(members.map((member) => member.status)) },
  });
}
