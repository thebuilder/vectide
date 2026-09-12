import { test, expect, type Page } from '@playwright/test';

async function start(page: Page, track = 0, trial = false) {
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testEngine = engine;',
    });
  });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator(`[data-track="${track}"]`).click();
  if (trial) await page.getByRole('button', { name: /TIME TRIAL/ }).click();
  await page.locator('#start').click();
  await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
}

test('gate guidance stays in view through a complete Storm lap', async ({ page }) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Isolate navigation across the full lap; weapon traffic has separate race coverage.
  await start(page, 2, true);
  await page.evaluate(async () => {
    const path = '/src/game/physics.ts';
    const { aiInput } = await import(path);
    const e = (window as any).__testEngine;
    e.input = () => aiInput(e.player, e.track, e.racers);
    (window as any).__guideChecks = { frames: 0, outside: 0, escaped: 0, samples: [] };
    const inspect = () => {
      const s = (window as any).__vectide;
      if (s.state !== 'racing' || s.player.laps.length) return;
      const box = document.getElementById('checkpoint')!.getBoundingClientRect();
      const checks = (window as any).__guideChecks;
      checks.frames++;
      if (s.checkpointGuide.outside) checks.outside++;
      if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) {
        checks.escaped++;
        if (checks.samples.length < 3)
          checks.samples.push({ box: box.toJSON(), guide: s.checkpointGuide });
      }
      requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  await page.waitForFunction(() => (window as any).__vectide.player.nextGate === 7);
  await page.screenshot({ path: 'artifacts/storm-checkpoint-guidance.png' });
  await page.waitForFunction(() => (window as any).__vectide.player.laps.length > 0, undefined, {
    timeout: 65000,
  });
  const lap = await page.evaluate(() => ({
    time: (window as any).__vectide.player.laps[0],
    recovered: (window as any).__vectide.player.recovered,
    checks: (window as any).__guideChecks,
  }));
  expect(lap.time).toBeGreaterThan(50);
  expect(lap.time).toBeLessThan(75);
  expect(lap.recovered).toBe(false);
  expect(lap.checks.frames).toBeGreaterThan(100);
  expect(lap.checks.outside).toBeGreaterThan(0);
  expect(lap.checks.escaped, JSON.stringify(lap.checks.samples)).toBe(0);
  expect(errors).toEqual([]);
});

test.describe('touch checkpoint guidance', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('off-screen gates keep a readable direction through turns and rotation', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page);
    await page.evaluate(() => {
      const e = (window as any).__testEngine;
      e.input = () => ({ throttle: 0, brake: 1, steer: 0, lean: 0 });
      e.player.vx = e.player.vz = 0;
      const g = e.track.gates[e.player.nextGate];
      e.player.yaw = Math.atan2(g.x - e.player.x, g.z - e.player.z) + Math.PI;
    });
    await expect(page.locator('#checkpoint')).toHaveAttribute('aria-label', /TURN BACK/);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(async () => {
          const b = await page.locator('#checkpoint').boundingBox();
          return (
            !!b &&
            b.x >= 0 &&
            b.y >= 0 &&
            b.x + b.width <= viewport.width &&
            b.y + b.height <= viewport.height
          );
        })
        .toBe(true);
      const box = await page.locator('#checkpoint').boundingBox();
      expect(box!.y + box!.height).toBeLessThan(viewport.height - 100);
      await expect(page.locator('#direction')).toBeVisible();
      expect(await page.locator('#direction svg').evaluate((el) => el.getAnimations().length)).toBe(
        0,
      );
      await page.screenshot({ path: `artifacts/checkpoint-offscreen-${viewport.width}.png` });
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect
      .poll(() => page.locator('#direction svg').evaluate((el) => el.getAnimations().length))
      .toBe(1);
    await page.locator('#pause').tap();
    await expect(page.locator('#checkpoint')).toBeHidden();
  });
});
