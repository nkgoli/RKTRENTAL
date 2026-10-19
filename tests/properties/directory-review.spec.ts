import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const databaseUrl =
  'postgresql://rocketrental:rocketrental@127.0.0.1:55431/rocketrental?schema=public';
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const evidence = path.resolve('tests/properties/evidence');
const observations: Record<string, unknown>[] = [];
fs.mkdirSync(evidence, { recursive: true });
async function capture(page: Page, name: string) {
  await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
}
async function signIn(page: Page, origin: string) {
  await page.goto(origin + '/sign-in');
  await page.getByLabel('Email address').fill('jordan.mills@rocketrental.example');
  await page.getByLabel('Password', { exact: true }).fill('JordanDemo#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    })),
  ).toEqual({ width: page.viewportSize()!.width, scroll: page.viewportSize()!.width });
}
async function openDialog(page: Page) {
  const current = new URL(page.url());
  current.searchParams.set('add', '1');
  const trigger = page.getByRole('link', { name: '+ Add property', exact: true });
  await expect(trigger).toHaveAttribute('href', current.pathname + current.search);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Add a property', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Property name', { exact: true })).toBeFocused();
  return dialog;
}

test.afterAll(async () => {
  const existing = fs.existsSync(path.join(evidence, 'chromium-observations.json'))
    ? JSON.parse(
        fs
          .readFileSync(path.join(evidence, 'chromium-observations.json'), 'utf8')
          .replace(/^\uFEFF/, ''),
      )
    : [];
  const identity = JSON.parse(
    fs
      .readFileSync(path.resolve('tests/properties/.runtime/review-config.json'), 'utf8')
      .replace(/^\uFEFF/, ''),
  );
  fs.writeFileSync(
    path.join(evidence, 'chromium-observations.json'),
    JSON.stringify(
      [
        ...existing,
        ...observations.map((item) => ({
          ...item,
          candidateCommit: identity.candidateCommit,
          candidateBuild: identity.candidateBuild,
          observedUtc: new Date().toISOString(),
        })),
      ],
      null,
      2,
    ),
  );
  await db.$disconnect();
});

test('unchanged baseline at desktop and 390px', async ({ page }) => {
  await signIn(page, 'http://localhost:3231');
  const organization = await db.user.findFirstOrThrow({
    where: { email: 'jordan.mills@rocketrental.example' },
    select: { organizationId: true },
  });
  const propertyCount = await db.property.count({
    where: { organizationId: organization.organizationId, archivedAt: null },
  });
  const prefix = propertyCount === 4 ? 'before' : 'before-current';
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('http://localhost:3231/properties');
    await expect(
      page.getByRole('region', { name: 'Property directory', exact: true }).getByRole('link'),
    ).toHaveCount(propertyCount);
    await noPageOverflow(page);
    await capture(page, `${prefix}-${width}-grid`);
    await page.getByRole('link', { name: 'List', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Properties', exact: true })).toBeVisible();
    await capture(page, `${prefix}-${width}-list`);
    observations.push({ flow: 'baseline', width, url: page.url(), properties: propertyCount });
  }
});

test('candidate seeded cards, filters, empty recovery and phone scrolling', async ({ page }) => {
  await signIn(page, 'http://localhost:3232');
  const organization = await db.user.findFirstOrThrow({
    where: { email: 'jordan.mills@rocketrental.example' },
    select: { organizationId: true },
  });
  const records = await db.property.findMany({
    where: { organizationId: organization.organizationId, archivedAt: null },
    include: { units: { where: { status: { not: 'ARCHIVED' } } } },
    orderBy: { name: 'asc' },
  });
  const units = records.flatMap((record) => record.units);
  const occupancy = Math.round(
    (units.filter((unit) => unit.status === 'OCCUPIED').length / units.length) * 100,
  );
  const multi = records.filter((record) => record.type === 'MULTI_UNIT').length;
  const single = records.filter((record) => record.type === 'SINGLE_UNIT').length;
  const vacancies = records.filter((record) =>
    record.units.some((unit) => unit.status !== 'OCCUPIED'),
  ).length;
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/properties');
    const directory = page.getByRole('region', { name: 'Property directory', exact: true });
    await expect(directory.getByRole('link')).toHaveCount(records.length);
    await expect(directory.getByRole('heading', { level: 3 })).toHaveText(
      records.map((record) => record.name),
    );
    await expect(page.getByText(`${occupancy}% occupancy`, { exact: true })).toBeVisible();
    expect(await directory.locator('a > div[aria-hidden=true] > svg').count()).toBe(records.length);
    await expect(directory.locator('a > div[aria-hidden=true] > svg').first()).toBeVisible();
    await noPageOverflow(page);
    await capture(page, `after-${width}-grid`);
    await directory.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/properties\/seed-property-elm$/);
    await page.goto('/properties');
    const filters = page.getByRole('navigation', { name: 'Property filters' });
    for (const [label, count] of [
      ['Multi-unit', multi],
      ['Single-unit', single],
      ['Has vacancies', vacancies],
    ] as const) {
      await filters.getByRole('link', { name: new RegExp('^' + label) }).click();
      await expect(page).toHaveURL(
        new RegExp(
          'filter=' +
            { 'Multi-unit': 'multi', 'Single-unit': 'single', 'Has vacancies': 'vacancies' }[label],
        ),
      );
      await expect(
        page.getByRole('region', { name: 'Property directory', exact: true }).getByRole('link'),
      ).toHaveCount(count);
      await expect(filters.getByRole('link', { name: new RegExp('^' + label) })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
    await filters.getByRole('link', { name: /^Archived/ }).click();
    await expect(
      page.getByRole('heading', { name: 'No properties match this view' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/properties$/);
    await expect(
      page.getByRole('region', { name: 'Property directory', exact: true }).getByRole('link'),
    ).toHaveCount(records.length);
    const search = page.getByRole('search');
    await search.getByRole('searchbox').fill('Cedar');
    await search.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=Cedar$/);
    await expect(
      page.getByRole('region', { name: 'Property directory', exact: true }).getByRole('link'),
    ).toHaveCount(1);
    await search.getByRole('searchbox').fill('No such directory fixture');
    await search.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'No properties match this view' }),
    ).toBeVisible();
    await capture(page, `after-${width}-empty-search`);
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/properties$/);
    await page.getByRole('link', { name: 'List', exact: true }).click();
    const region = page.getByRole('region', { name: /Property directory table/ });
    await expect(region.getByRole('columnheader')).toHaveCount(6);
    await region.focus();
    if (width === 390) {
      const before = await region.evaluate((el) => el.scrollLeft);
      for (let index = 0; index < 12; index++) await page.keyboard.press('ArrowRight');
      await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
    }
    await noPageOverflow(page);
    await capture(page, `after-${width}-list`);
    observations.push({
      flow: 'seeded directory',
      width,
      cards: records.length,
      filters: { multi, single, vacancies, archived: 0 },
      search: 'Cedar1/no-match0',
      tableColumns: 6,
      tableScrollLeft: await region.evaluate((el) => el.scrollLeft),
      url: page.url(),
    });
  }
});

test('Chromium modal semantics, cancellation and actual validation at both widths', async ({
  page,
}) => {
  await signIn(page, 'http://localhost:3232');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/properties?view=list&filter=multi&q=Maple');
    let dialog = await openDialog(page);
    await dialog.getByLabel('City', { exact: true }).fill('Retained city');
    await dialog.getByRole('button', { name: 'Save property', exact: true }).click();
    await expect(dialog.getByText('Property name is required', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Property name', { exact: false })).toBeFocused();
    await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Retained city');
    await capture(page, `after-${width}-validation`);
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/properties\?view=list&filter=multi&q=Maple$/);
    await expect(page.getByRole('link', { name: '+ Add property', exact: true })).toBeFocused();
    dialog = await openDialog(page);
    await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('');
    await capture(page, `after-${width}-add-dialog`);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/properties\?view=list&filter=multi&q=Maple$/);
    observations.push({
      flow: 'dialog errors and cancel',
      width,
      valuesRetained: true,
      focusTrap: true,
      escape: true,
      returnFocus: true,
      queryPreserved: true,
    });
  }
});

test('actual multi and single creation persists and uses existing destinations', async ({
  page,
}) => {
  await signIn(page, 'http://localhost:3232');
  const organization = await db.user.findFirstOrThrow({
    where: { email: 'jordan.mills@rocketrental.example' },
    select: { organizationId: true },
  });
  for (const type of ['MULTI_UNIT', 'SINGLE_UNIT'] as const) {
    await page.setViewportSize({ width: type === 'MULTI_UNIT' ? 1280 : 390, height: 1000 });
    await page.goto('/properties');
    const dialog = await openDialog(page);
    const name = `Directory review ${type} ${Date.now()}`;
    await dialog.getByLabel('Property name', { exact: true }).fill(name);
    await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption(type);
    await dialog.getByLabel('Street address', { exact: true }).fill('73 Isolated Fixture Lane');
    await dialog.getByLabel('City', { exact: true }).fill('Austin');
    await dialog.getByLabel('State', { exact: true }).fill('TX');
    await dialog.getByLabel('ZIP', { exact: true }).fill('78704');
    if (type === 'MULTI_UNIT')
      await dialog.getByLabel('Number of units', { exact: false }).fill('2');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/properties?add=1', async (route) => {
      if (route.request().method() === 'POST') await gate;
      await route.continue();
    });
    const submit = dialog
      .getByRole('button', { name: 'Save property', exact: true })
      .click({ noWaitAfter: true });
    await expect(dialog.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
    await capture(page, `after-create-${type}-saving`);
    release();
    await submit;
    await expect(page).toHaveURL(/\/properties\/[^/?]+$/);
    await page.unroute('**/properties?add=1');
    const id = new URL(page.url()).pathname.split('/')[2];
    const property = await db.property.findUniqueOrThrow({
      where: { id },
      include: { units: true },
    });
    expect(property.name).toBe(name);
    expect(property.type).toBe(type);
    expect(property.organizationId).toBe(organization.organizationId);
    expect(property.units).toHaveLength(type === 'MULTI_UNIT' ? 2 : 1);
    if (type === 'SINGLE_UNIT') expect(property.units[0].isImplicit).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await capture(page, `after-create-${type}-persisted`);
    observations.push({
      flow: 'actual creation',
      type,
      id,
      name,
      units: property.units.length,
      url: page.url(),
      organizationScoped: true,
      reloadPersisted: true,
      pendingDisabled: true,
    });
  }
});
