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

test('pointer navigation never paints the home and setup content together', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-actions')).toHaveJSProperty('inert', false);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const overlapFrames = await page.evaluate(async () => {
      const home = document.getElementById('menu-home')!;
      const setup = document.getElementById('race-setup')!;
      let overlaps = 0;
      const painted = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return style.visibility === 'visible' && Number(style.opacity) > 0;
      };
      const click = (id: string) =>
        document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { detail: 1 }));
      const observe = async (duration: number) => {
        const end = performance.now() + duration;
        while (performance.now() < end) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (painted(home) && painted(setup)) overlaps++;
        }
      };
      click('open-setup');
      await observe(350);
      click('setup-back');
      await observe(350);
      // Reverse twice before entry finishes, then return home.
      click('open-setup');
      await observe(50);
      click('setup-back');
      await observe(50);
      click('open-setup');
      await observe(350);
      click('setup-back');
      await observe(350);
      return overlaps;
    });
    expect(overlapFrames).toBe(0);
    await expect(page.locator('#open-setup')).toBeFocused();
  }
});
