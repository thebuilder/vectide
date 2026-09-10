import { test, expect } from '@playwright/test';

test('keeps checkpoint guidance in view through a full Storm lap and when facing away', async ({
  page,
}) => {
  test.setTimeout(110000);
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
  await page.evaluate(async () => {
    const path = '/src/game/physics.ts';
    const { aiInput } = await import(path);
    const e = (window as any).__testEngine;
    e.input = () => aiInput(e.player, e.track, e.racers);
    const render = e.onRender;
    (window as any).guidance = { samples: 0, offscreen: 0, violations: [] };
    e.onRender = () => {
      render();
      if (e.state !== 'racing' || e.player.laps.length) return;
      const marker = document.getElementById('checkpoint')!;
      const bounds = marker.getBoundingClientRect();
      const report = (window as any).guidance;
      report.samples++;
      if (marker.dataset.offscreen === 'true') report.offscreen++;
      if (
        marker.hidden ||
        bounds.left < 8 ||
        bounds.right > innerWidth - 8 ||
        bounds.top < 60 ||
        bounds.bottom > innerHeight * 0.75
      )
        report.violations.push({ gate: e.player.nextGate, x: bounds.x, y: bounds.y });
    };
  });
  for (const gate of [3, 4, 7, 8]) {
    await page.waitForFunction((g) => (window as any).__vectide.player.nextGate === g, gate);
    await page.screenshot({ path: `artifacts/storm-navigation-${gate}.png` });
  }
  await page.waitForFunction(() => (window as any).__vectide.player.laps.length > 0, undefined, {
    timeout: 85000,
  });
  const report = await page.evaluate(() => ({
    ...(window as any).guidance,
    lap: (window as any).__vectide.player.laps[0],
  }));
  expect(report.samples).toBeGreaterThan(500);
  expect(report.offscreen).toBeGreaterThan(0);
  expect(report.violations).toEqual([]);
  expect(report.lap).toBeLessThan(75);

  for (const size of [
    { width: 360, height: 780 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.evaluate(() => {
      const e = (window as any).__testEngine;
      e.state = 'paused';
      const gate = e.track.gates[e.player.nextGate];
      e.player.yaw = Math.atan2(gate.x - e.player.x, gate.z - e.player.z) + Math.PI;
    });
    await expect(page.locator('#checkpoint')).toHaveAttribute('data-offscreen', 'true');
    const bounds = await page.locator('#checkpoint').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(8);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width - 8);
    expect(bounds!.y + bounds!.height).toBeLessThan(size.height * 0.75);
    await page.screenshot({ path: `artifacts/checkpoint-${size.width}.png` });
  }
  await page.evaluate(() => (window as any).__testEngine.menu());
  await expect(page.locator('#checkpoint')).toBeHidden();
  expect(errors).toEqual([]);
});
