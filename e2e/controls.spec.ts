import { test, expect } from '@playwright/test';
test('gamepad navigates menus, starts and pauses once per press, and resets', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    Object.assign(window, { testPad: pad });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const button = async (index: number, down: boolean) =>
    page.evaluate(
      async ({ index, down }) => {
        const pad = (
          window as unknown as { testPad: { buttons: { pressed: boolean; value: number }[] } }
        ).testPad;
        pad.buttons[index] = { pressed: down, value: down ? 1 : 0 };
        // Input is polled per frame; do not let a slow GPU skip a synthetic press.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      },
      { index, down },
    );
  const tap = async (index: number) => {
    await button(index, true);
    await button(index, false);
  };
  await tap(15);
  await expect(page.locator('#open-setup')).toBeFocused();
  await tap(0);
  await expect(page.locator('[data-track="0"]')).toBeFocused();
  await tap(15);
  await expect(page.locator('[data-track="1"]')).toBeFocused();
  await tap(0);
  await expect(page.locator('[data-track="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-input', 'gamepad');
  await expect(page.locator('.race-help')).toContainText('X');
  await page.locator('#start').focus();
  await tap(0);
  await expect(page.locator('#countdown')).toBeVisible();
  await button(9, true);
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await button(9, false);
  await page.waitForTimeout(80);
  await tap(9);
  await expect(page.locator('#pause-dialog')).toBeHidden();
  await button(7, true);
  await page.waitForFunction(
    () => (window as unknown as { __vectide: { speed: number } }).__vectide.speed > 15,
  );
  await button(7, false);
  await tap(2);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __vectide: { player: { recovered: boolean } } }).__vectide.player
          .recovered,
    ),
  ).toBe(true);
  await tap(9);
  await expect(page.locator('#resume')).toBeFocused();
  await tap(13);
  await expect(page.locator('#restart')).toBeFocused();
  await tap(13);
  await expect(page.locator('#exit')).toBeFocused();
  await tap(0);
  await expect(page.locator('#menu')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('body')).toHaveAttribute('data-input', 'keyboard');
});
test('WASD and arrows navigate and activate course controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#open-setup')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-track="0"]')).toBeFocused();
  await page.keyboard.press('KeyD');
  await expect(page.locator('[data-track="1"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-track="1"]')).toHaveAttribute('aria-pressed', 'true');
});
