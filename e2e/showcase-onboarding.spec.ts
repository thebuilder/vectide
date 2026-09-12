import { test, expect } from '@playwright/test';

test('controls open at the beginning and return to the still-paused race', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 633 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#help').click();
  await expect(page.locator('#help-title')).toBeFocused();
  await expect(page.locator('#help-title')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.help-objective')).toBeInViewport({ ratio: 1 });
  expect(await page.locator('#help-dialog').evaluate((el) => el.scrollTop)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#help')).toBeFocused();
  await page.locator('#open-setup').click();
  await page.getByRole('button', { name: 'Easy', exact: true }).click();
  await expect(page.locator('#difficulty-description')).toContainText('Slower opponents');
  await page.locator('#start').click();
  await page.locator('#pause').click();
  await page.locator('#pause-help').click();
  await expect(page.locator('#help-title')).toBeFocused();
  await page.getByText('Jumps, weight shifts and pickups', { exact: true }).click();
  await expect(page.locator('#help-dialog details')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await expect(page.locator('#pause-help')).toBeFocused();
  expect(await page.evaluate(() => (window as any).__vectide.state)).toBe('paused');
  await page.locator('#resume').click();
  await expect(page.locator('#pause-dialog')).toBeHidden();
});

test.describe('small-screen setup', () => {
  test.use({ isMobile: true, hasTouch: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    test(`Start Race stays visible while setup scrolls at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await page.locator('#open-setup').tap();
      await expect(page.locator('#start')).toBeInViewport({ ratio: 1 });
      await page.locator('[data-track="2"]').tap();
      await page.getByRole('button', { name: 'Expert', exact: true }).tap();
      await expect(page.locator('#start')).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `artifacts/setup-polished-${viewport.width}.png` });
      await page.locator('#help').tap();
      await expect(page.locator('#help-title')).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('heading', { name: 'TOUCH CONTROLS' })).toBeVisible();
      await expect(page.locator('#help-dialog')).toContainText('Throttle is automatic');
      await expect(page.locator('#close-help')).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `artifacts/help-polished-${viewport.width}.png` });
    });
  }
});

test('first driving tips respond to input and remember dismissal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  const coach = page.locator('#ride-coach');
  await expect(coach).toContainText('Hold to accelerate');
  await page.keyboard.down('w');
  await expect(coach).toContainText('Steer between both glowing buoys', { timeout: 15000 });
  await page.keyboard.up('w');
  await page.locator('#pause').click();
  await expect(coach).toBeHidden();
  await page.locator('#resume').click();
  await expect(coach).toBeVisible();
  await coach.getByRole('button', { name: 'Dismiss driving tips' }).click();
  await expect(coach).toBeHidden();
  await page.reload();
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  await expect(coach).toBeHidden();
});
