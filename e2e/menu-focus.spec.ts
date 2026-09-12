import { test, expect } from '@playwright/test';

test('directions follow menu rows instead of jumping diagonally', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('[data-mode="trial"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#start')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-mode="trial"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-mode="race"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-mode="race"]')).toBeFocused();
  await page.locator('[data-track="2"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#pickups-toggle')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-difficulty="expert"]')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-track="0"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-track="0"]')).toBeFocused();
});

test('keyboard can leave sliders vertically while native value keys still work', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('#start').click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#music-volume')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#music-volume')).toHaveValue('59');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#sounds-volume')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator('#sounds-volume')).toHaveValue('0');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#music-volume')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#resume')).toBeFocused();
});

test('gamepad includes form fields and stays inside the active dialog', async ({ page }) => {
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
  await page.locator('#join-online').click();
  const tap = async (index: number) => {
    for (const down of [true, false])
      await page.evaluate(
        async ({ index, down }) => {
          const pad = (
            window as unknown as { testPad: { buttons: { pressed: boolean; value: number }[] } }
          ).testPad;
          pad.buttons[index] = { pressed: down, value: Number(down) };
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        },
        { index, down },
      );
  };
  await expect(page.locator('#join-code')).toBeFocused();
  await tap(12);
  await expect(page.locator('#racer-name')).toBeFocused();
  await tap(13);
  await expect(page.locator('#join-code')).toBeFocused();
  await tap(13);
  await expect(page.locator('#join-room')).toBeFocused();
  await tap(13);
  await expect(page.locator('#cancel-online')).toBeFocused();
  await tap(13);
  await expect(page.locator('#cancel-online')).toBeFocused();
  await tap(1);
  await expect(page.locator('#join-online')).toBeFocused();
  await page.locator('#join-online').click();
  await page.locator('#racer-name').fill('WASD');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('x');
  await expect(page.locator('#racer-name')).toHaveValue('WxASD');
  await tap(1);
  await page.locator('#open-setup').click();
  // Mostly vertical stick movement must not be taken as horizontal simply because X is nonzero.
  await page.evaluate(async () => {
    const pad = (window as unknown as { testPad: { axes: number[] } }).testPad;
    pad.axes = [0.65, 0.95, 0, 0];
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    pad.axes = [0, 0, 0, 0];
  });
  await expect(page.locator('[data-difficulty="normal"]')).toBeFocused();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`directional navigation follows the ${viewport.width}px setup through scrolling options`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.locator('#open-setup').click();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-track="1"]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-track="2"]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-difficulty]:focus')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#pickups-toggle')).toBeFocused();
    const visible = await page.locator('#pickups-toggle').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element
      );
    });
    expect(visible).toBe(true);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-mode] :focus, [data-mode]:focus')).toHaveCount(1);
    if (viewport.width >= 700) {
      await page.keyboard.press('ArrowRight');
      // The closest mode can be either column after the responsive options scroll.
      if (await page.locator('[data-mode="trial"]').evaluate((e) => e === document.activeElement))
        await page.keyboard.press('ArrowRight');
    } else await page.keyboard.press('ArrowDown');
    await expect(page.locator('#start')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#countdown')).toBeVisible();
    await context.close();
  });

test('focus has a stable inner ring and a pulsing halo that respects reduced motion', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#race-setup')).toHaveCSS('opacity', '1');
  await expect(page.locator('#menu-home')).toHaveCSS('opacity', '0');
  await page.waitForFunction(
    () =>
      !(window as unknown as { __vectide: { intro: { active: boolean } } }).__vectide.intro.active,
  );
  const focused = page.locator('[data-track="1"]');
  await expect(focused).toBeFocused();
  await expect(focused).toHaveCSS('outline-style', 'solid');
  await expect(focused).toHaveCSS('outline-width', '3px');
  await expect(focused).toHaveCSS('outline-offset', '-3px');
  await expect(focused).toHaveCSS('animation-name', 'focus-pulse');
  const shadows = await focused.evaluate((element) => {
    const animation = element
      .getAnimations()
      .find((a) => (a as CSSAnimation).animationName === 'focus-pulse')!;
    animation.pause();
    animation.currentTime = 0;
    const start = getComputedStyle(element).boxShadow;
    animation.currentTime = 800;
    return [start, getComputedStyle(element).boxShadow];
  });
  expect(shadows[0]).not.toBe(shadows[1]);
  await page.screenshot({ path: 'artifacts/focus-pulse-desktop.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(focused).toHaveCSS('animation-name', 'none');
  await expect(focused).toHaveCSS('outline-width', '3px');
});
