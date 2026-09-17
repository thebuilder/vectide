import { expect, test } from '@playwright/test';

test('keyboard weight shifts change ordinary flight without preparing a stunt', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/fixtures/coast.html');
  await page.waitForFunction(() => !!(window as any).demo);
  const results = [];
  for (const key of ['c', '', 'Shift']) {
    await page.evaluate(() => {
      const e = (window as any).demo;
      e.onFrame = () => {};
      e.start('trial');
      e.state = 'paused';
      Object.assign(e.track, {
        wave: 0,
        waveZones: [],
        shore: undefined,
        land: [],
        ramps: [],
        obstacles: [],
      });
      Object.assign(e.player, { x: 0, z: 0, y: 4, vx: 0, vz: 20, vy: 3, yaw: 0, pitch: 0, wet: 0 });
      e.jets[0].visible = true;
    });
    await page.keyboard.down('w');
    if (key) await page.keyboard.down(key);
    // Use the real keyboard input and physics, with fixed time for a fair comparison.
    results.push(
      await page.evaluate(async () => {
        const e = (window as any).demo;
        const path = '/src/game/physics.ts';
        const { stepRacer } = await import(path);
        let elapsed = 0;
        while (elapsed < 4) {
          stepRacer(e.player, e.input(), e.track, elapsed, 1 / 120);
          elapsed += 1 / 120;
          if (e.player.wet > 0) break;
        }
        return { elapsed, lean: e.input().lean, pitch: e.player.pitch, armed: e.player.air.armed };
      }),
    );
    if (key) await page.keyboard.up(key);
    await page.keyboard.up('w');
  }
  expect(results.map((r) => r.lean)).toEqual([-1, 0, 1]);
  expect(results[0].elapsed).toBeLessThan(results[1].elapsed - 0.08);
  expect(results[2].elapsed).toBeGreaterThan(results[1].elapsed + 0.05);
  expect(results[0].pitch).toBeLessThan(-0.3);
  expect(results[2].pitch).toBeGreaterThan(0.3);
  expect(results.every((r) => !r.armed)).toBe(true);
  expect(errors).toEqual([]);
});
