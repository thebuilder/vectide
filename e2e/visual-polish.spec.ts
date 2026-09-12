import { test, expect } from '@playwright/test';

for (const track of [0, 1, 2]) {
  test(`water contact, visual capture and frame pacing on course ${track}`, async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (e) => {
      if (e.type() === 'error') errors.push(e.text());
    });
    await page.route('**/src/main.ts*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__testEngine = engine;',
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('#open-setup').click();
    await page.locator(`[data-track="${track}"]`).click();
    await page.locator('#start').click();
    await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
    await page.evaluate(async () => {
      const path = '/src/game/physics.ts',
        { aiInput } = await import(path);
      const e = (window as any).__testEngine;
      e.input = () => aiInput(e.player, e.track, e.racers);
    });
    await page.waitForFunction(() => (window as any).__vectide.time > 7);
    await page.screenshot({ path: `artifacts/visual-polish-course-${track}.png` });
    const measurement = await page.evaluate(async () => {
      const e = (window as any).__testEngine,
        frames: number[] = [];
      let previous = performance.now();
      for (let i = 0; i < 120; i++) {
        const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
        frames.push(now - previous);
        previous = now;
      }
      frames.sort((a, b) => a - b);
      return {
        median: frames[60],
        p95: frames[114],
        calls: e.renderer.info.render.calls,
        triangles: e.renderer.info.render.triangles,
        wake: e.wake.activeSegments,
        particles: e.sprayCount,
      };
    });
    console.log(`course ${track}`, measurement);
    // The native-GPU profile has a 30fps floor; software renderers are not hardware benchmarks.
    if (process.env.PLAYWRIGHT_GPU) expect(measurement.p95).toBeLessThan(34);
    expect(measurement.wake).toBeGreaterThan(0);
    expect(measurement.wake).toBeLessThan(12 * 72);
    expect(errors).toEqual([]);
  });
}
