import { test, expect } from '@playwright/test';

test('final split leads into animated results while autopilot keeps riding', async ({ page }) => {
  // Expose the real engine only in this intercepted development response.
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testEngine = engine;',
    });
  });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.getByRole('button', { name: /TIME TRIAL/ }).click();
  await page.locator('#start').click();
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 10000 });
  await page.evaluate(() => {
    const e = (window as any).__testEngine;
    const r = e.racers[0],
      g = e.track.gates[0];
    Object.assign(r, {
      x: g.x - g.tx * 0.05,
      z: g.z - g.tz * 0.05,
      vx: g.tx * 12,
      vz: g.tz * 12,
      yaw: Math.atan2(g.tx, g.tz),
      nextGate: 0,
      lap: 1,
      lapStart: 0,
    });
    e.time = 60;
  });
  await expect(page.locator('#lap-split')).toBeVisible();
  await expect(page.locator('#lap-split')).toContainText('LAP 1');
  await expect(page.locator('#results')).not.toBeVisible();
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 });
  const before = await page.evaluate(() => (window as any).__vectide);
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => (window as any).__vectide);
  expect(after.time).toBe(before.time);
  expect(after.player.laps).toEqual(before.player.laps);
  expect(
    Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z),
  ).toBeGreaterThan(2);
  expect(await page.locator('#results').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'results-enter',
  );
  await page.getByRole('button', { name: 'RIDE AGAIN' }).click();
  await expect(page.locator('#results')).not.toBeVisible();
  await expect(page.locator('#lap-split')).not.toBeVisible();
});
