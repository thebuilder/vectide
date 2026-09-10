import { test, expect } from '@playwright/test';
test('metadata, soundtrack menu, difficulty toggle, and GO countdown', async ({ page }) => {
  await page.goto('/');
  await page.locator('#open-setup').click();
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

test('menu replaces the title in place and retains selections through back navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#menu-home')).toBeVisible();
  await expect(page.locator('#race-setup')).toBeHidden();
  await expect(page.locator('#race-setup')).toHaveJSProperty('inert', true);
  await page.locator('#open-setup').click();
  await expect(page.locator('#menu-home')).toBeHidden();
  await expect(page.locator('#race-setup')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#race-setup .course.selected')).toBeFocused();
  await page.locator('[data-track="2"]').click();
  await page.locator('[data-mode="trial"]').click();
  await page.locator('[data-difficulty="expert"]').click();
  await page.locator('#setup-back').click();
  await expect(page.locator('#open-setup')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-track="2"]')).toBeFocused();
  await expect(page.locator('[data-mode="trial"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-difficulty="expert"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#start')).toHaveText('START TIME TRIAL');
  await page.keyboard.press('Escape');
  await expect(page.locator('#open-setup')).toBeFocused();
  expect(
    await page
      .locator('.menu-screen')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s');
});

test('pointer transitions fade and slide, reverse cleanly, and fit phones', async ({ page }) => {
  await page.goto('/');
  await page.locator('#open-setup').click();
  await expect(page.locator('#menu')).toHaveAttribute('data-instant', 'false');
  const motion = await page.locator('#race-setup').evaluate((el) => ({
    properties: getComputedStyle(el).transitionProperty,
    duration: getComputedStyle(el).transitionDuration,
  }));
  expect(motion.properties).toContain('opacity');
  expect(motion.properties).toContain('transform');
  expect(motion.duration).toContain('0.24s');
  // Reverse before the first transition finishes, then enter again.
  await page.locator('#setup-back').dispatchEvent('click', { detail: 1 });
  await page.locator('#open-setup').dispatchEvent('click', { detail: 1 });
  await expect(page.locator('#menu-home')).toBeHidden();
  await expect(page.locator('#race-setup')).toHaveJSProperty('inert', false);
  await page.locator('#setup-back').click();
  await expect(page.locator('#open-setup svg')).toHaveAttribute('aria-hidden', 'true');
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    for (const id of ['open-setup', 'host-online', 'join-online']) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    }
    expect(await page.locator('#menu-home').evaluate((el) => el.scrollTop)).toBe(0);
  }
});

test('setup keeps the start action visible on a compact phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#open-setup').click();
  const start = await page.locator('#start').boundingBox();
  const panel = await page.locator('#race-setup').boundingBox();
  expect(start!.y + start!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
});
