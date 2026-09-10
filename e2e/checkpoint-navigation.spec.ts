import { test, expect } from '@playwright/test';

test('keeps the compact HUD indicator fixed through a full Storm lap', async ({ page }) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testEngine = engine;',
    });
  });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('[data-track="2"]').click();
  await page.locator('#start').click();
  await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
  const before = await page.locator('#checkpoint').boundingBox();
  await page.evaluate(async () => {
    const path = '/src/game/physics.ts';
    const { aiInput } = await import(path);
    const e = (window as any).__testEngine;
    e.input = () => aiInput(e.player, e.track, e.racers);
  });
  await page.waitForFunction(() => (window as any).__vectide.player.nextGate === 7);
  const after = await page.locator('#checkpoint').boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 0);
  expect(after!.y).toBeCloseTo(before!.y, 0);
  expect(
    await page.locator('#checkpoint').evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({ path: 'artifacts/storm-static-guidance.png' });
  await page.waitForFunction(() => (window as any).__vectide.player.laps.length > 0, undefined, {
    timeout: 65000,
  });
  const lap = await page.evaluate(() => ({
    time: (window as any).__vectide.player.laps[0],
    recovered: (window as any).__vectide.player.recovered,
  }));
  expect(lap.time).toBeGreaterThan(50);
  expect(lap.time).toBeLessThan(75);
  expect(lap.recovered).toBe(false);
  expect(errors).toEqual([]);
});
