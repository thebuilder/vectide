import { test, expect } from '@playwright/test';
test('metadata, soundtrack menu, difficulty toggle, and GO countdown', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
    'href',
    'https://vectide.thebuilder.dk/',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://vectide.thebuilder.dk/og.png',
  );
  const image = await page.request.get('/og.png');
  expect(image.ok()).toBe(true);
  const data = await image.body();
  expect(data.readUInt32BE(16)).toBe(1200);
  expect(data.readUInt32BE(20)).toBe(630);
  await page.getByRole('button', { name: 'Expert', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expert', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#soundtrack-label').click();
  await page.getByRole('button', { name: 'Neon Slipway', exact: true }).click();
  await expect(page.locator('#soundtrack-label')).toHaveText('Neon Slipway');
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toHaveText('3');
  await expect(page.locator('#countdown')).toHaveText('2');
  await expect(page.locator('#countdown')).toHaveText('1');
  await expect(page.locator('#countdown')).toHaveText('GO!');
  await expect(page.locator('#countdown')).toBeHidden();
});
