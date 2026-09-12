import { test, expect } from '@playwright/test';

for (const [index, id] of [
  [1, 'harbor'],
  [2, 'storm'],
] as const) {
  test(`${id} has spaced pickups, no ramps, and a complete rendered lap`, async ({ page }) => {
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
    await page.locator(`[data-track="${index}"]`).click();
    await page.locator('#start').click();
    await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
    const setup = await page.evaluate(async () => {
      const path = '/src/game/physics.ts';
      const { aiInput } = await import(path);
      const e = (window as any).__testEngine;
      e.input = () => aiInput(e.player, e.track, e.racers);
      return {
        ramps: e.track.ramps.length,
        crates: e.items.boxes.length,
        dolphins: !!e.scene.getObjectByName('dolphin-pod'),
        boat: !!e.scene.getObjectByName('offshore-cargo-boat'),
        heading:
          Math.sin(e.player.yaw) * e.track.gates[0].tx +
          Math.cos(e.player.yaw) * e.track.gates[0].tz,
      };
    });
    expect(setup.ramps).toBe(0);
    expect(setup.crates).toBe(15);
    expect(setup.boat).toBe(id === 'storm');
    expect(setup.dolphins).toBe(id !== 'storm');
    expect(setup.heading).toBeGreaterThan(0.99);
    await page.waitForFunction(() => (window as any).__vectide.player.nextGate === 2);
    await page.screenshot({ path: `artifacts/${id}-pickup-spacing.png` });
    await page.waitForFunction(() => (window as any).__vectide.player.nextGate === 8);
    await page.screenshot({ path: `artifacts/${id}-course-flow.png` });
    await page.waitForFunction(() => {
      const e = (window as any).__vectide;
      return e.player.nextGate === e.track.gates.length - 1;
    });
    await page.screenshot({ path: `artifacts/${id}-final-approach.png` });
    await page.waitForFunction(() => (window as any).__vectide.player.laps.length > 0);
    const lap = await page.evaluate(() => ({
      time: (window as any).__vectide.player.laps[0],
      recovered: (window as any).__vectide.player.recovered,
      crashes: (window as any).__vectide.player.recovery.crashes,
    }));
    expect(lap.time).toBeGreaterThan(50);
    expect(lap.time).toBeLessThan(75);
    expect(lap.recovered).toBe(false);
    expect(lap.crashes).toBe(0);
    expect(errors).toEqual([]);
  });
}
