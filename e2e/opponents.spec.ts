import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testEngine=engine;',
    });
  });
  await page.goto('/');
});

test('single-player races start at the back and retain that slot on reset; trials stay solo', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const e = (window as any).__testEngine;
    const path = '/src/game/physics.ts';
    const { createRacer } = await import(path);
    const rows = [];
    for (let index = 0; index < 3; index++) {
      e.selectTrack(index);
      e.start('race');
      const player = e.player,
        g = e.track.gates[0],
        start = { x: player.x, z: player.z };
      const position = e.snapshot().position;
      const ahead = e.racers.filter(
        (r: any) => r.id !== 0 && (r.x - player.x) * g.tx + (r.z - player.z) * g.tz > 0,
      ).length;
      player.x += 20;
      e.state = 'racing';
      e.reset();
      rows.push({
        ahead,
        position,
        id: player.id,
        reset: Math.hypot(player.x - start.x, player.z - start.z),
      });
      e.start('trial');
      const solo = createRacer(e.track, 0);
      if (e.racers.length !== 1 || e.player.x !== solo.x || e.player.z !== solo.z)
        throw new Error('Trial grid changed');
    }
    return rows;
  });
  expect(result).toEqual(
    Array.from({ length: 3 }, () => ({ ahead: 5, position: 6, id: 0, reset: 0 })),
  );
});

test('Normal keeps two rivals competitive through a full rendered three-lap Port race', async ({
  page,
}) => {
  test.setTimeout(260000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.locator('#open-setup').click();
  await page.locator('[data-track="1"]').click();
  await page.locator('[data-difficulty="normal"]').click();
  await page.locator('#pickups-toggle').click();
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.screenshot({ path: 'artifacts/normal-rear-grid.png' });
  await page.waitForFunction(() => (window as any).__testEngine.state === 'racing');
  await page.evaluate(async () => {
    const path = '/src/game/physics.ts';
    const { aiInput, catchupPower } = await import(path);
    const e = (window as any).__testEngine;
    e.input = () => aiInput(e.player, e.track, e.racers, 'expert');
    const maxima = [1, 1, 1, 1, 1, 1];
    (window as any).__catchupMaxima = maxima;
    const inspect = () => {
      for (const r of e.racers)
        maxima[r.id] = Math.max(maxima[r.id], catchupPower(r, e.player, e.track));
      if (!e.player.finished) requestAnimationFrame(inspect);
    };
    inspect();
  });
  await page.waitForFunction(
    () => (window as any).__testEngine.player.laps.length >= 1,
    undefined,
    { timeout: 90000 },
  );
  await page.screenshot({ path: 'artifacts/normal-after-first-lap.png' });
  await page.waitForFunction(
    () => (window as any).__testEngine.racers.slice(0, 3).every((r: any) => r.finished),
    undefined,
    { timeout: 170000 },
  );
  const result = await page.evaluate(() => {
    const e = (window as any).__testEngine;
    return {
      times: e.racers.slice(0, 3).map((r: any) => r.finishTime),
      laps: e.player.laps.length,
      crashes: e.racers.map((r: any) => r.recovery.crashes),
      recovered: e.racers.some((r: any) => r.recovered),
      maxima: (window as any).__catchupMaxima,
    };
  });
  console.log('Normal race', result);
  expect(result.laps).toBe(3);
  expect(
    Math.min(...result.times.slice(1).map((time: number) => Math.abs(time - result.times[0]))),
  ).toBeLessThan(10);
  expect(result.recovered).toBe(false);
  expect(result.crashes).toEqual([0, 0, 0, 0, 0, 0]);
  expect(result.maxima[0]).toBe(1);
  expect(result.maxima.slice(3)).toEqual([1, 1, 1]);
  expect(Math.max(...result.maxima)).toBeGreaterThan(1);
  expect(Math.max(...result.maxima)).toBeLessThanOrEqual(1.12);
  expect(errors).toEqual([]);
});
