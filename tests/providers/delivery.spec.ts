import { Prisma, PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();
const organizationId = 'seed-rocket-rental';
const secret = process.env.MOCK_WEBHOOK_SECRET ?? 'dev-webhook-secret';
const sign = (body: string) => {
  const timestamp = Math.floor(Date.now() / 1000);
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
};

test.afterAll(async () => prisma.$disconnect());

test('signed mock deliveries update both stores, dedupe, and report failures', async ({
  request,
}) => {
  await prisma.webhookEvent.deleteMany({
    where: {
      provider: 'mock',
      externalEventId: {
        in: ['e2e-payment-delivered', 'e2e-screening-delivered', 'e2e-screening-failure'],
      },
    },
  });
  await prisma.payment.upsert({
    where: { id: 'e2e-webhook-payment' },
    update: { status: 'PENDING', paidAt: null },
    create: {
      id: 'e2e-webhook-payment',
      organizationId,
      leaseId: 'seed-lease-cedar-4',
      amount: 1650,
      status: 'PENDING',
      providerReference: 'e2e-webhook-payment-ref',
    },
  });
  await prisma.application.update({
    where: { id: 'seed-application-marcus' },
    data: { status: 'SCREENING', decisionReason: null, decidedBy: null, decidedAt: null },
  });
  await prisma.screeningReport.update({
    where: {
      provider_providerReference: { provider: 'transunion', providerReference: 'SM-48292' },
    },
    data: { status: 'pending', summary: Prisma.DbNull, completedAt: null },
  });
  const deliver = (body: string) =>
    request.post('/api/webhooks/mock', {
      data: body,
      headers: { 'x-mock-signature': sign(body), 'content-type': 'application/json' },
    });
  const payment = JSON.stringify({
    id: 'e2e-payment-delivered',
    type: 'payment.succeeded',
    organizationId,
    data: { providerReference: 'e2e-webhook-payment-ref' },
  });
  expect((await deliver(payment)).status()).toBe(200);
  expect(await (await deliver(payment)).json()).toMatchObject({ duplicate: true });
  expect(
    (await prisma.payment.findUniqueOrThrow({ where: { id: 'e2e-webhook-payment' } })).status,
  ).toBe('SUCCEEDED');

  const screening = JSON.stringify({
    id: 'e2e-screening-delivered',
    type: 'screening.report.completed',
    organizationId,
    data: {
      applicationId: 'seed-application-marcus',
      provider: 'transunion',
      providerReference: 'SM-48292',
      status: 'complete',
      creditScore: 718,
      background: 'clear',
      eviction: 'clear',
    },
  });
  expect((await deliver(screening)).status()).toBe(200);
  expect(
    (
      await prisma.screeningReport.findFirstOrThrow({
        where: { applicationId: 'seed-application-marcus' },
      })
    ).status,
  ).toBe('complete');
  expect(
    (await prisma.application.findUniqueOrThrow({ where: { id: 'seed-application-marcus' } }))
      .status,
  ).toBe('REVIEW');

  const failure = JSON.stringify({
    id: 'e2e-screening-failure',
    type: 'screening.report.completed',
    organizationId,
    data: {
      applicationId: 'seed-application-marcus',
      provider: 'transunion',
      providerReference: 'missing-report',
      status: 'complete',
    },
  });
  expect((await deliver(failure)).status()).toBe(500);
  const connection = await prisma.providerConnection.findUniqueOrThrow({
    where: {
      organizationId_kind_provider: { organizationId, kind: 'SCREENING', provider: 'transunion' },
    },
  });
  expect(
    (connection.settings as { health: { lastWebhookStatus: string } }).health.lastWebhookStatus,
  ).toBe('failed');
  expect(
    await prisma.webhookEvent.count({
      where: { provider: 'mock', externalEventId: 'e2e-screening-failure' },
    }),
  ).toBe(0);
  expect((await deliver(failure)).status()).toBe(500);
});
