import { expect, test } from '@playwright/test';

test('Space and steering slide the stern; releasing Space restores grip', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/e2e/fixtures/coast.html');
  await page.waitForFunction(() => !!(window as any).demo);
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
    Object.assign(e.player, { x: 0, z: 0, y: 0.6, vx: 0, vz: 22, vy: 0, yaw: 0, pitch: 0 });
  });
  await page.keyboard.down('Space');
  await page.keyboard.down('a');
  const slide = await page.evaluate(async () => {
    const e = (window as any).demo;
    const path = '/src/game/physics.ts';
    const { stepRacer } = await import(path);
    for (let i = 0; i < 72; i++) stepRacer(e.player, e.input(), e.track, i / 120, 1 / 120);
    const r = e.player;
    return {
      speed: Math.hypot(r.vx, r.vz),
      yaw: r.yaw,
      slip: Math.abs(Math.atan2(r.vx, r.vz) - r.yaw),
    };
  });
  expect(slide.speed).toBeGreaterThan(12);
  expect(slide.yaw).toBeGreaterThan(0.7);
  expect(slide.slip).toBeGreaterThan(0.6);
  await page.keyboard.up('Space');
  await page.keyboard.up('a');
  await page.keyboard.down('w');
  const exit = await page.evaluate(async () => {
    const e = (window as any).demo;
    const path = '/src/game/physics.ts';
    const { stepRacer } = await import(path);
    for (let i = 0; i < 120; i++) stepRacer(e.player, e.input(), e.track, (72 + i) / 120, 1 / 120);
    const r = e.player;
    return { speed: Math.hypot(r.vx, r.vz), slip: Math.abs(Math.atan2(r.vx, r.vz) - r.yaw) };
  });
  await page.keyboard.up('w');
  expect(exit.slip).toBeLessThan(slide.slip * 0.3);
  expect(exit.speed).toBeGreaterThan(slide.speed);
  expect(errors).toEqual([]);
});
