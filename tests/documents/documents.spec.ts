import { expect, test } from '@playwright/test';

const managerEmail = 'jordan.mills@rocketrental.example';
const managerPassword = process.env.ROCKETRENTAL_DEMO_MANAGER_PASSWORD ?? 'JordanDemo#2026';

test('manager uploads a lease file, finds it, previews and downloads it', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(managerEmail);
  await page.getByLabel('Password').fill(managerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'Documents', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lease documents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Property files' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Photos', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/documents-library.png', fullPage: true });

  const name = `Documents flow ${Date.now()}.pdf`;
  await page.getByRole('link', { name: 'Upload files' }).first().click();
  const upload = page.getByRole('dialog', { name: 'Upload files' });
  await upload.getByLabel('Upload destination').selectOption('seed-lease-maple-11');
  await upload.getByLabel('File type').selectOption('LEASE');
  await upload.getByLabel('Choose files').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'),
  });
  // The uploader sends the file as soon as it is chosen.
  await expect(page.getByRole('status').filter({ hasText: `${name} uploaded.` })).toBeVisible();
  await upload.getByRole('button', { name: 'Close' }).click();

  const leaseGroup = page.getByRole('link', {
    name: /Lease: Maple Court · Unit 4B — Alex Rivera/,
  });
  await expect(leaseGroup).toBeVisible();
  const fileRow = page.locator('[data-document-row]', { hasText: name });
  await expect(fileRow).toBeVisible();

  await page.getByLabel('Search files, leases or properties').fill(name);
  await page.getByLabel('Search files, leases or properties').press('Enter');
  await expect(fileRow).toBeVisible();
  await expect(page.getByText('1 matching file', { exact: true })).toBeVisible();

  const previewUrl = await fileRow.getByRole('link', { name: /^Preview / }).getAttribute('href');
  expect(previewUrl).toMatch(/^\/api\/files\/[^/]+\/preview$/);
  const preview = await page.request.get(previewUrl!);
  expect(preview.ok()).toBe(true);
  expect(preview.headers()['content-disposition']).toContain('inline');

  const downloadUrl = await fileRow.getByRole('link', { name: /^Download / }).getAttribute('href');
  expect(downloadUrl).toMatch(/^\/api\/files\/[^/]+\/download$/);
  const download = await page.request.get(downloadUrl!);
  expect(download.ok()).toBe(true);
  expect(download.headers()['content-disposition']).toContain('attachment');
  expect((await download.body()).toString()).toContain('%PDF-1.4');
  await page.screenshot({ path: 'test-results/documents-lease-uploaded.png', fullPage: true });

  const fileUrl = downloadUrl!.replace(/\/download$/, '');
  const deleted = await page.request.delete(fileUrl, {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(deleted.status()).toBe(204);
});
