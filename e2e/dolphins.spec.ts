import { test, expect } from '@playwright/test';

for (const { name, track, viewport } of [
  { name: 'Palm desktop', track: 0, viewport: { width: 1280, height: 800 } },
  { name: 'Harbor desktop', track: 1, viewport: { width: 1280, height: 800 } },
  { name: 'Palm phone', track: 0, viewport: { width: 844, height: 390 } },
])
  test(`${name} dolphins approach and make readable breaches beside the rider`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text()))
        errors.push(message.text());
    });
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
      const check = {
        frames: [0, 0, 0],
        readable: [0, 0, 0],
        seenPod: false,
        done: false,
        foam: false,
        splash: false,
      };
      (window as any).__dolphinCheck = check;
      const visibleSince: (number | null)[] = [null, null, null];
      const matrix = new T.Matrix4();
      const onRender = engine.onRender;
      engine.onRender = () => {
        onRender();
        engine.scene.getObjectByName('dolphin-pod').children.forEach((animal: any, i: number) => {
          const { x, y, z } = animal.position;
          if (!animal.visible || y - waterHeight(x, z, engine.visualTime, engine.track) < 0.0) {
            visibleSince[i] = null;
            return;
          }
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
          if (clipped) visibleSince[i] = null;
          else {
            visibleSince[i] ??= engine.visualTime;
            check.readable[i] = Math.max(check.readable[i], engine.visualTime - visibleSince[i]!);
          }
        });
        const effects = engine.scene.getObjectByName('dolphin-water');
        for (let i = 0; i < effects.count; i++) {
          effects.getMatrixAt(i, matrix);
          const m = matrix.elements,
            height = Math.hypot(m[4], m[5], m[6]);
          if (height === 0) continue;
          const screen = new T.Vector3(m[12], m[13], m[14]).project(engine.camera);
          if (Math.abs(screen.x) >= 1 || Math.abs(screen.y) >= 1 || Math.abs(screen.z) >= 1)
            continue;
          if (height < 0.04) check.foam = true;
          if (m[13] > waterHeight(m[12], m[14], engine.visualTime, engine.track) + 0.3)
            check.splash = true;
        }
        if (check.frames.every((frames: number) => frames > 0)) check.seenPod = true;
        if (
          check.seenPod &&
          engine.scene
            .getObjectByName('dolphin-pod')
            .children.every((animal: any) => !animal.visible)
        )
          check.done = true;
      };
    });
    await page.waitForFunction(() => (window as any).__dolphinCheck.seenPod);
    await page.screenshot({
      path: `artifacts/${name.toLowerCase().replaceAll(' ', '-')}-dolphins.png`,
    });
    await page.waitForFunction(() => (window as any).__dolphinCheck.done);
    const check = await page.evaluate(() => (window as any).__dolphinCheck);
    expect(check.frames.every((frames: number) => frames > 15)).toBe(true);
    // Free-swimming companions can leave the camera in a turn, but each must offer a clear breach.
    expect(check.readable.every((seconds: number) => seconds >= 0.3)).toBe(true);
    expect(check.foam).toBe(true);
    expect(check.splash).toBe(true);
    expect(errors).toEqual([]);
  });
