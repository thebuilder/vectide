import { expect, test } from '@playwright/test';

test('collects all Storm rows on a rendered checkpoint-to-checkpoint lap', async ({ page }) => {
  test.setTimeout(85000);
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
  await page.evaluate(async () => {
    const path = '/src/game/physics.ts';
    const { angle, clamp } = await import(path);
    const e = (window as any).__testEngine;
    // Use a solo lap with pickups enabled to measure collection without opponent/weapon interference.
    e.start('trial');
    const pickupsPath = '/src/game/pickups.ts';
    const { Pickups } = await import(pickupsPath);
    e.items = new Pickups(e.track, true);
    const rows = new Set<number>();
    (window as any).__pickupRowsCollected = rows;
    e.input = () => {
      e.items.state.cooldowns.forEach((cooldown: number, index: number) => {
        if (cooldown > 0) rows.add(e.items.boxes[index].row);
      });
      e.player.item = 0;
      e.player.itemReadyIn = 0;
      const r = e.player,
        gate = e.track.gates[r.nextGate];
      const turn = angle(Math.atan2(gate.x - r.x, gate.z - r.z) - r.yaw);
      const speed = Math.hypot(r.vx, r.vz);
      const targetSpeed = 23 - Math.min(Math.abs(turn) * 14, 18);
      return {
        throttle: clamp((targetSpeed - speed) * 0.4 + 0.65, 0, 1),
        brake: clamp((speed - targetSpeed - 1) / 12, 0, 0.7),
        steer: clamp(turn * 2.4, -1, 1),
        lean: 0,
      };
    };
  });
  await page.waitForFunction(() => {
    const e = (window as any).__testEngine;
    const row = e.items.boxes[1];
    return e.player.nextGate === 2 && Math.hypot(e.player.x - row.x, e.player.z - row.z) < 35;
  });
  await page.screenshot({ path: 'artifacts/storm-pickups-direct-line.png' });
  await page.waitForFunction(() => {
    const e = (window as any).__testEngine;
    const gate = e.track.gates[3];
    return e.player.nextGate === 3 && Math.hypot(e.player.x - gate.x, e.player.z - gate.z) < 45;
  });
  await page.screenshot({ path: 'artifacts/storm-channel-width.png' });
  await page.waitForFunction(() => (window as any).__testEngine.player.laps.length > 0);
  const result = await page.evaluate(() => {
    const e = (window as any).__testEngine;
    return {
      lap: e.player.laps[0],
      crashes: e.player.recovery.crashes,
      recovered: e.player.recovered,
      rows: [...(window as any).__pickupRowsCollected].sort(),
      width: e.track.gates[3].width,
    };
  });
  expect(result.rows).toEqual([0, 1, 2, 3, 4]);
  expect(result.lap).toBeGreaterThan(40);
  expect(result.lap).toBeLessThan(65);
  expect(result.crashes).toBe(0);
  expect(result.recovered).toBe(false);
  expect(result.width).toBeGreaterThan(65);
  expect(errors).toEqual([]);
  console.log('Storm direct riding line', result);
});
