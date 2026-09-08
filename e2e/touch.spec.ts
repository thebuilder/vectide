import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test('mobile menu fits and simultaneous touch controls release safely', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-input', 'touch');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#start').tap();
  await page.waitForFunction(
    () => (window as unknown as { __vectide: { state: string } }).__vectide.state === 'racing',
  );
  const cdp = await page.context().newCDPSession(page);
  const center = async (key: string) => {
    const r = await page.locator(`[data-touch-key="${key}"]`).boundingBox();
    return { x: r!.x + r!.width / 2, y: r!.y + r!.height / 2 };
  };
  const go = await center('throttle'),
    left = await center('left');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { ...go, id: 1 },
      { ...left, id: 2 },
    ],
  });
  await expect(page.locator('[data-touch-key="throttle"]')).toHaveClass(/held/);
  await expect(page.locator('[data-touch-key="left"]')).toHaveClass(/held/);
  await page.waitForFunction(
    () => (window as unknown as { __vectide: { speed: number } }).__vectide.speed > 8,
  );
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 195, y: 400, id: 1 },
      { ...left, id: 2 },
    ],
  });
  await expect(page.locator('[data-touch-key="throttle"]')).toHaveClass(/held/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#touch-controls .held')).toHaveCount(0);
  await page.locator('[data-touch-key="reset"]').tap();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __vectide: { player: { recovered: boolean } } }).__vectide.player
          .recovered,
    ),
  ).toBe(true);
  await page.locator('#pause').tap();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#resume').tap();
  await page.setViewportSize({ width: 844, height: 390 });
  for (const key of ['left', 'right', 'throttle', 'brake', 'lean', 'reset']) {
    const box = await page.locator(`[data-touch-key="${key}"]`).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(390);
  }
});
