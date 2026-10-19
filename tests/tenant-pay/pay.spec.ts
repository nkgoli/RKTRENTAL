import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

/**
 * Tenant pay flow at phone width (390px) against the demo database.
 */
const prisma = new PrismaClient();
const alexLease = 'seed-lease-maple-11';
const alexTenant = 'seed-tenant-maple-11';
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async () => {
  // Keep the test independent of a prior successful run, without reseeding the portfolio.
  await prisma.autopaySetting.deleteMany({ where: { leaseId: alexLease, tenantId: alexTenant } });
  await prisma.paymentMethod.deleteMany({ where: { tenantId: alexTenant } });
  await prisma.payment.deleteMany({
    where: {
      leaseId: alexLease,
      NOT: { id: { startsWith: 'seed-payment-alex-' } },
    },
  });
  await prisma.charge.deleteMany({
    where: { leaseId: alexLease, description: `rent:${alexLease}:2026-11` },
  });
});
test.afterAll(async () => prisma.$disconnect());
const tenantEmail = 'alex.rivera@email.com';
const tenantPassword = process.env.ROCKETRENTAL_DEMO_TENANT_PASSWORD ?? 'AlexDemo#2026';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(tenantEmail);
  await page.getByLabel('Password').fill(tenantPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('pay screen requires a tenant session', async ({ page }) => {
  await page.goto('/pay');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('Alex Rivera pays $1,850 by card with the mock provider', async ({ page }) => {
  await signIn(page);
  // The dev server compiles /pay on first hit and can reset that first navigation.
  await page.goto('/pay').catch(() => page.goto('/pay'));
  await expect(page.getByRole('heading', { name: /Pay \w+ rent/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Amount due' })).toBeVisible();
  await expect(page.getByText('$1,850', { exact: true }).first()).toBeVisible();
  // Exactly one month is billed: the amount defaults to a single $1,850, never $3,700.
  await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('1850.00');
  await expect(page.getByRole('heading', { name: 'Recent receipts' })).toBeVisible();
  await expect(page.getByText('October rent')).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-screen.png', fullPage: true });

  // Card through the provider hosted field; the passed-on fee is shown before paying.
  await page.getByRole('radio', { name: /Card/ }).check();
  await expect(page.getByText(/fee \(2\.9%\)/)).toBeVisible();
  await page.getByRole('button', { name: /Pay \$/ }).click();
  await expect(page.getByRole('button', { name: 'Confirm payment' })).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-confirm.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirm payment' }).click();

  await expect(page.getByText('Payment received.')).toBeVisible();
  await expect(page.getByText(/all paid up/)).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'Paid' }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-receipt.png', fullPage: true });
});

test('autopay turns on with a saved method and back off', async ({ page }) => {
  await signIn(page);
  await page.goto('/pay');
  await page.getByRole('button', { name: /Add bank account/ }).click();
  await expect(page.getByText('Payment method added.')).toBeVisible();

  const toggle = page.getByRole('switch', { name: 'Autopay' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Currently on')).toBeVisible();
  await page.screenshot({ path: 'test-results/tenant-pay-autopay.png', fullPage: true });

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Currently off')).toBeVisible();
});

test('one native payment reaches its receipt and a retry cannot charge again', async ({ page }) => {
  await signIn(page);
  await page.goto('/pay');
  await page.getByRole('radio', { name: /^Card/ }).check();
  await page.getByRole('button', { name: /^Pay \$/ }).click();
  let posts = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/pay/submit') posts++;
  });
  const prevented = await page
    .locator('form[action="/pay/submit"]')
    .evaluate((form: HTMLFormElement) => {
      const events: SubmitEvent[] = [];
      form.addEventListener('submit', (event) => events.push(event as SubmitEvent));
      const button = form.querySelector<HTMLButtonElement>('button[name="confirmPayment"]')!;
      form.requestSubmit(button);
      form.requestSubmit(button);
      return events.map((event) => event.defaultPrevented);
    });
  expect(prevented).toEqual([false, true]);
  await expect(page).toHaveURL(/notice=paid#payment-result$/);
  await expect(page.getByText('Payment received.')).toBeVisible();
  const payments = { leaseId: alexLease, NOT: { id: { startsWith: 'seed-payment-alex-' } } };
  expect(await prisma.payment.count({ where: payments })).toBe(1);
  expect(posts).toBe(1);
  // Same authenticated request against an updated ledger returns duplicate, never a second charge.
  const retry = await page.request.post('/pay/submit', {
    headers: { Origin: new URL(page.url()).origin },
    form: {
      leaseId: alexLease,
      amount: '1850.00',
      method: 'card',
      providerToken: 'tok_mock_card_4242',
      confirmPayment: 'yes',
    },
    maxRedirects: 0,
  });
  expect(retry.headers().location).toContain('notice=payment-duplicate');
  expect(await prisma.payment.count({ where: payments })).toBe(1);
  await page.screenshot({
    path: 'tests/tenant-pay/evidence/payment-receipt-after.png',
    fullPage: true,
  });
});

test('native failure returns visible focused feedback without charging or auto retry', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/pay');
  await page.getByRole('button', { name: /^Pay \$/ }).click();
  let posts = 0;
  await page.route('**/pay/submit', async (route) => {
    posts++;
    const body = new URLSearchParams(route.request().postData()!);
    body.set('leaseId', 'not-the-tenants-lease');
    await route.continue({ postData: body.toString() });
  });
  await page.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(page).toHaveURL(/notice=payment-failed#payment-result$/);
  await expect(page.locator('#payment-result').getByRole('alert')).toContainText(
    'Nothing was charged.',
  );
  await expect(page.locator('#payment-result')).toBeFocused();
  expect(posts).toBe(1);
  expect(
    await prisma.payment.count({
      where: { leaseId: alexLease, NOT: { id: { startsWith: 'seed-payment-alex-' } } },
    }),
  ).toBe(0);
  await expect(page.getByRole('button', { name: /^Pay \$/ })).toBeEnabled();
  await page.screenshot({
    path: 'tests/tenant-pay/evidence/payment-failure-after.png',
    fullPage: true,
  });
});

test('partial ACH payment navigates directly to pending receipt feedback', async ({ page }) => {
  await signIn(page);
  await page.goto('/pay');
  await page.getByRole('textbox', { name: 'Amount' }).fill('500.00');
  await page.getByRole('button', { name: 'Pay $500' }).click();
  await page.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(page).toHaveURL(/notice=pending#payment-result$/);
  await expect(page.getByText('Bank payment started.')).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'Pending' })).toBeVisible();
  const payments = await prisma.payment.findMany({
    where: { leaseId: alexLease, NOT: { id: { startsWith: 'seed-payment-alex-' } } },
  });
  expect(payments).toHaveLength(1);
  expect(payments[0].status).toBe('PENDING');
  expect(Number(payments[0].amount)).toBe(500);
  await page.screenshot({
    path: 'tests/tenant-pay/evidence/payment-pending-after.png',
    fullPage: true,
  });
});
