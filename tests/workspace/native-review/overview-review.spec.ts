import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const databaseUrl =
  process.env.OVERVIEW_DATABASE_URL ??
  'postgresql://rocketrental:rocketrental@127.0.0.1:55441/rocketrental?schema=public';
const baselineOrigin = process.env.OVERVIEW_BASELINE_URL ?? 'http://localhost:3241';
const candidateOrigin = process.env.OVERVIEW_CANDIDATE_URL ?? 'http://localhost:3242';
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const evidence = path.resolve('tests/workspace/native-review/evidence');
const synthDir = path.resolve('tests/workspace/native-review/.runtime/synth');
const observations: Record<string, unknown>[] = [];

const MAPLE = 'seed-property-maple';
const MAPLE_VACANT_3A = 'seed-unit-maple-7';
const MAPLE_OCCUPIED_4B = 'seed-unit-maple-11';
const ELM = 'seed-property-elm';

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

async function propertyHeadings(page: Page) {
  await expect(page.getByRole('heading', { name: 'Maple Court', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payments this month' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lease timeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Units' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Property details' })).toBeVisible();
}

/** Disposable synthetic property with one vacant unit; removed in afterAll. */
let synthPropertyId = '';
let synthUnitId = '';

test.beforeAll(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  fs.mkdirSync(synthDir, { recursive: true });
  // 1x1 PNG fixture generated locally; no binary is committed.
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    Buffer.from('0000000d4948445200000001000000010802000000907753de', 'hex'),
    Buffer.from('0000000c4944415478da6360606060000000004 0001e606024e'.replace(/ /g, ''), 'hex'),
    Buffer.from('0000000049454e44ae426082', 'hex'),
  ]);
  fs.writeFileSync(path.join(synthDir, 'synth-a.png'), png);
  fs.writeFileSync(path.join(synthDir, 'synth-b.png'), png);
  const stamp = Date.now().toString(36);
  synthPropertyId = `synth-ov-prop-${stamp}`;
  synthUnitId = `synth-ov-unit-${stamp}`;
  await db.property.create({
    data: {
      id: synthPropertyId,
      organizationId: 'seed-rocket-rental',
      name: `Overview Synthetic ${stamp}`,
      type: 'MULTI_UNIT',
      street: '7 Synthetic Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78704',
      units: {
        create: {
          id: synthUnitId,
          organizationId: 'seed-rocket-rental',
          number: 'S1',
          status: 'VACANT',
          listedRent: 1500,
        },
      },
    },
  });
});

test.afterAll(async () => {
  const identity = JSON.parse(
    fs.readFileSync(path.resolve('tests/workspace/native-review/.runtime/review-config.json'), 'utf8'),
  );
  const existing = fs.existsSync(path.join(evidence, 'chromium-observations.json'))
    ? JSON.parse(fs.readFileSync(path.join(evidence, 'chromium-observations.json'), 'utf8'))
    : [];
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
  if (synthPropertyId) {
    const docs = await db.document.findMany({
      where: { organizationId: 'seed-rocket-rental', targetId: { in: [synthPropertyId, synthUnitId] } },
      select: { id: true, storageKey: true },
    });
    await db.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
    await db.unit.deleteMany({ where: { id: synthUnitId } });
    await db.property.deleteMany({ where: { id: synthPropertyId } });
    const storage = process.env.OVERVIEW_STORAGE_DIR;
    for (const doc of docs) {
      if (storage && doc.storageKey) {
        for (const candidate of [path.join(storage, doc.storageKey), doc.storageKey]) {
          try {
            if (fs.existsSync(candidate)) fs.rmSync(candidate, { force: true });
          } catch {
            /* best effort */
          }
        }
      }
    }
  }
  await db.$disconnect();
});

test('candidate property overview at desktop and 390px', async ({ page }) => {
  await signIn(page, candidateOrigin);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(`/properties/${MAPLE}`);
    await propertyHeadings(page);
    await expect(page.getByLabel('Switch unit')).toBeVisible();
    await expect(page.getByRole('link', { name: /Open unit 4B/ }).first()).toBeVisible();
    await expect(page.getByText('Property occupancy')).toBeVisible();
    if (width === 390) {
      await expect(page.getByRole('article').filter({ hasText: 'Unit 4B' }).first()).toBeVisible();
    } else {
      await expect(page.getByRole('table', { name: 'Property units' })).toBeVisible();
    }
    await noPageOverflow(page);
    await capture(page, `after-${width}-property`);
    observations.push({ flow: 'candidate property overview', width, occupancy: true, url: page.url() });
  }
});

test('candidate occupied and vacant unit scopes with switcher and keyboard', async ({ page }) => {
  await signIn(page, candidateOrigin);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/properties/${MAPLE}?unit=${MAPLE_OCCUPIED_4B}`);
  await expect(page.getByRole('heading', { name: 'Maple Court · Unit 4B' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lease timeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payments this month' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unit facts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next steps' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Photos & documents' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View lease' })).toBeVisible();
  await expect(page.getByLabel('Switch unit')).toHaveValue(MAPLE_OCCUPIED_4B);
  // Scoped tabs keep the unit scope.
  const sections = page.getByRole('navigation', { name: 'Workspace sections' });
  await expect(sections.getByRole('link', { name: 'Leases' })).toHaveAttribute(
    'href',
    new RegExp(`unit=${MAPLE_OCCUPIED_4B}`),
  );

  // Keyboard: focus the switcher, move to the vacant unit, confirm navigation.
  await page.getByLabel('Switch unit').focus();
  await expect(page.getByLabel('Switch unit')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`unit=${MAPLE_VACANT_3A}`));
  await expect(page.getByRole('heading', { name: 'Maple Court · Unit 3A' })).toBeVisible();
  await expect(page.getByText('No active lease on this unit.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create lease' })).toBeVisible();
  await capture(page, 'after-1280-unit-vacant');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/properties/${MAPLE}?unit=${MAPLE_OCCUPIED_4B}`);
  await expect(page.getByRole('heading', { name: 'Maple Court · Unit 4B' })).toBeVisible();
  await noPageOverflow(page);
  await capture(page, 'after-390-unit-occupied');
  observations.push({ flow: 'candidate unit scopes', occupied: true, vacant: true });
});

test('candidate inline edit cancel, validation and save on disposable records', async ({ page }) => {
  await signIn(page, candidateOrigin);
  await page.setViewportSize({ width: 1280, height: 1000 });

  // Cancel keeps the seeded vacant unit untouched.
  await page.goto(`/properties/${MAPLE}?unit=${MAPLE_VACANT_3A}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Bedrooms', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Bedrooms', { exact: true })).not.toBeVisible();
  const persisted = await db.unit.findUniqueOrThrow({ where: { id: MAPLE_VACANT_3A } });
  expect(persisted.bedrooms).not.toBe(9);

  // Validation is surfaced inline without persisting.
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Bathrooms', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Bathrooms must be a number like 1 or 1.5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // Save persists on the disposable synthetic property only.
  await page.goto(`/properties/${synthPropertyId}`);
  await expect(page.getByRole('heading', { name: /Overview Synthetic/ })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('City', { exact: true }).fill('Georgetown');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Georgetown', { exact: true }).first()).toBeVisible({ timeout: 20000 });
  const saved = await db.property.findUniqueOrThrow({ where: { id: synthPropertyId } });
  expect(saved.city).toBe('Georgetown');
  observations.push({ flow: 'candidate inline edit', cancel: true, validation: true, save: true });
});

test('candidate add-unit on the disposable synthetic property', async ({ page }) => {
  await signIn(page, candidateOrigin);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/properties/${synthPropertyId}`);
  await page.getByRole('link', { name: '+ Add unit', exact: true }).click();
  await expect(page).toHaveURL(/#add-unit$/);
  await expect(page.getByRole('heading', { name: 'Add unit' })).toBeVisible();
  await page.getByRole('button', { name: 'Save unit', exact: true }).click();
  await expect(page.getByText('Unit number is required', { exact: true })).toBeVisible();
  await page.getByLabel('Unit number', { exact: true }).fill('S2');
  await page.getByLabel('Monthly rent', { exact: true }).fill('1600');
  await page.getByRole('button', { name: 'Save unit', exact: true }).click();
  await expect(page.getByRole('link', { name: /Open unit S2/ }).first()).toBeVisible({ timeout: 20000 });
  const created = await db.unit.findFirstOrThrow({
    where: { propertyId: synthPropertyId, number: 'S2' },
  });
  expect(created.listedRent?.toString()).toContain('1600');
  await db.unit.delete({ where: { id: created.id } });
  observations.push({ flow: 'candidate add-unit', created: 'S2', cleaned: true });
});

test('candidate guarded delete and archive states, no confirmed deletion', async ({ page }) => {
  await signIn(page, candidateOrigin);
  await page.setViewportSize({ width: 1280, height: 1000 });

  // Synthetic vacant unit with no linked records: guard opens, dismissal keeps it.
  await page.goto(`/properties/${synthPropertyId}?unit=${synthUnitId}`);
  const deleteButton = page.getByRole('button', { name: 'Delete unit', exact: true });
  await expect(deleteButton).toBeEnabled();
  let confirmText = '';
  page.once('dialog', async (dialog) => {
    confirmText = dialog.message();
    await dialog.dismiss();
  });
  await deleteButton.click();
  await expect.poll(() => confirmText, { timeout: 10000 }).toContain('Delete this empty unit?');
  await expect(page).toHaveURL(new RegExp(`unit=${synthUnitId}`));
  expect(await db.unit.findUnique({ where: { id: synthUnitId } })).not.toBeNull();

  // Single-family implicit unit: deletion is disabled with its guard note.
  await page.goto(`/properties/${ELM}?unit=seed-unit-elm-1`);
  await expect(page.getByRole('button', { name: 'Delete unit', exact: true })).toBeDisabled();
  await expect(page.getByText('The single-family home unit cannot be deleted.')).toBeVisible();
  observations.push({ flow: 'candidate delete guards', dismissed: true, deleted: false });
});

test('candidate synthetic media upload, cover, reorder, remove and preview recovery', async ({
  page,
}) => {
  test.setTimeout(180000);
  await signIn(page, candidateOrigin);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/properties/${synthPropertyId}`);

  async function upload(name: string) {
    await page.locator('#photos input[type="file"]').setInputFiles(path.join(synthDir, name));
    await expect(page.getByRole('img', { name }).or(page.getByText(name))).toBeVisible({ timeout: 30000 });
  }

  await upload('synth-a.png');
  await upload('synth-b.png');
  await expect(page.getByText('synth-a.png')).toBeVisible();
  await expect(page.getByText('synth-b.png')).toBeVisible();

  await page.getByRole('button', { name: 'Set synth-a.png as cover' }).click();
  await expect(page.getByRole('button', { name: 'Current cover' })).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: 'Move synth-b.png up' }).click();
  await expect(page.locator('.photoName, [class*="photoName"]').first()).toContainText('synth-b.png', {
    timeout: 20000,
  });

  // Preview-failure recovery: remove the stored binary, reload, placeholder appears.
  const docs = await db.document.findMany({
    where: { organizationId: 'seed-rocket-rental', targetId: synthPropertyId },
    select: { id: true, storageKey: true },
  });
  expect(docs.length).toBeGreaterThanOrEqual(2);
  const storage = process.env.OVERVIEW_STORAGE_DIR ?? '';
  const stored = docs
    .map((d) => (storage && d.storageKey ? path.join(storage, d.storageKey) : ''))
    .filter((p) => p && fs.existsSync(p));
  expect(stored.length).toBeGreaterThan(0);
  const hidden = stored[0] + '.hidden-by-review';
  fs.renameSync(stored[0], hidden);
  await page.reload();
  await expect(page.getByText(/Preview unavailable for/, { exact: false }).first()).toBeVisible({
    timeout: 20000,
  });
  await capture(page, 'after-1280-preview-unavailable');
  fs.renameSync(hidden, stored[0]);

  // Remove both synthetic photos; the gallery returns to its empty state.
  await page.reload();
  for (const name of ['synth-a.png', 'synth-b.png']) {
    await page.getByRole('button', { name: `Remove ${name}` }).click();
    await expect(page.getByText(name, { exact: true })).not.toBeVisible({ timeout: 20000 });
  }
  await expect(page.getByText('No photos yet.')).toBeVisible();
  observations.push({ flow: 'candidate media', upload: 2, cover: true, reorder: true, previewRecovery: true });
});

test('baseline property and unit overviews load at both widths', async ({ page }) => {
  await signIn(page, baselineOrigin);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(`/properties/${MAPLE}`);
    await expect(page.getByRole('heading', { name: 'Maple Court', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open unit 4B/ }).first()).toBeVisible();
    await noPageOverflow(page);
    await capture(page, `before-${width}-property`);
    await page.goto(`/properties/${MAPLE}?unit=${MAPLE_OCCUPIED_4B}`);
    await expect(page.getByRole('heading', { name: 'Maple Court · Unit 4B' })).toBeVisible();
    await noPageOverflow(page);
    await capture(page, `before-${width}-unit-occupied`);
    observations.push({ flow: 'baseline overview', width, url: page.url() });
  }
});
