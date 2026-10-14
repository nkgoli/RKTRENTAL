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
  await expect(page.getByRole('heading', { name: 'Documents and photos', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lease documents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Property files' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
  await page.screenshot({ path: 'test-results/documents-library.png', fullPage: true });

  const name = `Documents flow ${Date.now()}.pdf`;
  await page.getByLabel('Upload destination').selectOption('seed-lease-maple-11');
  await page.getByLabel('File type').selectOption('LEASE');
  await page.getByLabel('Choose a file to upload').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n'),
  });
  await page.getByRole('button', { name: 'Upload file' }).click();
  await expect(page.getByRole('status')).toContainText(`${name} uploaded.`);

  const leaseGroup = page.getByRole('link', {
    name: /Lease: Maple Court · Unit 4B — Alex Rivera/,
  });
  await expect(leaseGroup).toBeVisible();
  const fileRow = page.locator('.file', { hasText: name });
  await expect(fileRow).toBeVisible();

  await page.getByLabel('Search files, leases or properties').fill(name);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(fileRow).toBeVisible();
  await expect(page.getByText('1 matching files')).toBeVisible();

  const previewUrl = await fileRow.getByRole('link', { name: 'Preview' }).getAttribute('href');
  expect(previewUrl).toMatch(/^\/api\/files\/[^/]+\/preview$/);
  const preview = await page.request.get(previewUrl!);
  expect(preview.ok()).toBe(true);
  expect(preview.headers()['content-disposition']).toContain('inline');

  const downloadUrl = await fileRow.getByRole('link', { name: 'Download' }).getAttribute('href');
  expect(downloadUrl).toMatch(/^\/api\/files\/[^/]+\/download$/);
  const download = await page.request.get(downloadUrl!);
  expect(download.ok()).toBe(true);
  expect(download.headers()['content-disposition']).toContain('attachment');
  expect((await download.body()).toString()).toContain('%PDF-1.4');
  await page.screenshot({ path: 'test-results/documents-lease-uploaded.png', fullPage: true });

  const fileUrl = downloadUrl!.replace(/\/download$/, '');
  const deleted = await page.request.delete(fileUrl);
  expect(deleted.status()).toBe(204);
});
