import { test, expect } from '@playwright/test';

test('Palm dolphins stay inside the chase camera throughout their breach', async ({ page }) => {
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
    const physicsPath = '/src/game/physics.ts',
      waterPath = '/src/game/water.ts',
      threePath = '/node_modules/.vite/deps/three.js';
    const [{ aiInput }, { waterHeight }, T] = await Promise.all([
      import(physicsPath),
      import(waterPath),
      import(threePath),
    ]);
    const engine = (window as any).__testEngine;
    engine.input = () => aiInput(engine.player, engine.track, engine.racers);
    const check = { frames: [0, 0, 0], clipped: [0, 0, 0], seenPod: false, done: false };
    (window as any).__dolphinCheck = check;
    const onRender = engine.onRender;
    engine.onRender = () => {
      onRender();
      let airborne = 0;
      engine.scene.getObjectByName('dolphin-pod').children.forEach((animal: any, i: number) => {
        const { x, y, z } = animal.position;
        if (!animal.visible || y - waterHeight(x, z, engine.visualTime, engine.track) < 0.5) return;
        airborne++;
        check.frames[i]++;
        // Test the whole animal's bounds, not just its center, against the real chase camera.
        const box = new T.Box3().setFromObject(animal);
        let clipped = false;
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const screen = new T.Vector3(x, y, z).project(engine.camera);
              if (Math.abs(screen.x) >= 1 || Math.abs(screen.y) >= 1 || Math.abs(screen.z) >= 1)
                clipped = true;
            }
        if (clipped) check.clipped[i]++;
      });
      if (airborne === 3) check.seenPod = true;
      if (check.seenPod && airborne === 0) check.done = true;
    };
  });
  await page.waitForFunction(() => (window as any).__dolphinCheck.seenPod);
  await page.screenshot({ path: 'artifacts/palm-dolphins.png' });
  await page.waitForFunction(() => (window as any).__dolphinCheck.done);
  const check = await page.evaluate(() => (window as any).__dolphinCheck);
  expect(check.frames.every((frames: number) => frames > 15)).toBe(true);
  expect(check.clipped).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});
