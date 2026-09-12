import { test, expect } from '@playwright/test';

test('Palm has a clear early bend and a rideable wave section through a full rendered lap', async ({
  page,
}) => {
  test.setTimeout(90000);
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
  await page.getByRole('button', { name: /TIME TRIAL/ }).click();
  await page.locator('#start').click();
  await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
  await page.evaluate(async () => {
    // Use the real driver and physics; expose this only in the intercepted test response.
    const path = '/src/game/physics.ts';
    const { aiInput } = await import(path);
    const engine = (window as any).__testEngine;
    engine.input = () => aiInput(engine.player, engine.track, engine.racers);
  });
  await page.waitForFunction(() => (window as any).__vectide.player.nextGate === 2);
  await page.screenshot({ path: 'artifacts/palm-early-bend.png' });
  await page.waitForFunction(() => {
    const state = (window as any).__vectide;
    return state.player.nextGate === 3 && state.player.x > 250 && state.player.wet === 0;
  });
  await page.screenshot({ path: 'artifacts/palm-restored-waves.png' });
  await expect(page.locator('#results')).toBeVisible({ timeout: 45000 });
  const finish = await page.evaluate(() => {
    const state = (window as any).__vectide;
    return {
      laps: state.player.laps,
      recovered: state.player.recovered,
      crashes: state.player.recovery.crashes,
    };
  });
  expect(finish.laps).toHaveLength(1);
  expect(finish.laps[0]).toBeGreaterThan(55);
  expect(finish.laps[0]).toBeLessThan(70);
  expect(finish.recovered).toBe(false);
  expect(finish.crashes).toBe(0);
  expect(errors).toEqual([]);
});
