import { test, expect } from '@playwright/test';

test('course motion follows selection and pauses when setup closes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#open-setup').click();
  const palm = page.locator('[data-track="0"] .course-tracer');
  const port = page.locator('[data-track="1"] .course-tracer');
  await expect(palm).toHaveCSS('animation-play-state', 'running');
  await page.locator('[data-track="1"]').click();
  await expect(palm).toBeHidden();
  await expect(port).toHaveCSS('animation-play-state', 'running');
  const before = await port.evaluate((el) => getComputedStyle(el).strokeDashoffset);
  await expect
    .poll(() => port.evaluate((el) => getComputedStyle(el).strokeDashoffset))
    .not.toBe(before);
  await page.locator('[data-mode="trial"]').click();
  await expect(page.locator('#start')).toHaveAccessibleName('START TIME TRIAL');
  await expect(page.locator('#start svg')).toHaveCount(1);
  await page.locator('#setup-back').click();
  await expect(port).toHaveCSS('animation-play-state', 'paused');
});

test('reduced motion keeps course selection static and keyboard activation immediate', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#open-setup').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-track="0"]')).toBeFocused();
  await expect(page.locator('[data-track="0"] .course-tracer')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#race-setup')).toHaveCSS('transition-duration', '0s');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-track="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-track="1"] .course-tracer')).toHaveCSS('animation-name', 'none');
});
