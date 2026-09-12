import { expect, test } from '@playwright/test';

for (const kind of [1, 2])
  for (const target of ['ramp', 'tower', 'shore'])
    test(`torpedo ${kind} hits ${target} and creates a rendered water explosion`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/src/main.ts*', async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: (await response.text()) + '\nwindow.__testEngine=engine;',
        });
      });
      await page.goto('/');
      await page.locator('#open-setup').click();
      await page.locator('#start').click();
      await page.waitForFunction(() => (window as any).__vectide.state === 'racing');
      await page.evaluate(
        async ({ kind, target }) => {
          const e = (window as any).__testEngine;
          cancelAnimationFrame(e.frameId);
          e.start('race');
          e.state = 'racing';
          e.time = 5;
          e.racers
            .slice(1)
            .forEach((r: any, i: number) => Object.assign(r, { x: 500 + i * 100, z: -500 }));
          const ramp = e.track.ramps[0],
            tower = e.track.obstacles[1];
          const position =
            target === 'ramp'
              ? {
                  x: ramp.x - ramp.tx * 30,
                  z: ramp.z - ramp.tz * 30,
                  yaw: Math.atan2(ramp.tx, ramp.tz),
                }
              : target === 'tower'
                ? { x: tower.x, z: tower.z - 25, yaw: 0 }
                : { x: 110, z: -10, yaw: 0 };
          const r = e.player;
          Object.assign(r, position, {
            vx: 0,
            vy: 0,
            vz: 0,
            item: kind,
            itemReadyIn: 0,
            wet: 1,
            nextGate: 2,
            passed: 2,
          });
          const path = '/src/game/water.ts',
            { waterHeight } = await import(path);
          r.y = waterHeight(r.x, r.z, e.visualTime, e.track) + 0.6;
          e.cameraAnchor.set(r.x, r.y, r.z);
          e.camera.position.set(r.x - Math.sin(r.yaw) * 8, r.y + 3, r.z - Math.cos(r.yaw) * 8);
          e.camTarget.set(r.x, r.y + 0.6, r.z);
          (window as any).explosions = [];
          const explosion = e.pickupVisuals.onExplosion;
          e.pickupVisuals.onExplosion = (...args: any[]) => {
            (window as any).explosions.push(args);
            explosion(...args);
          };
          e.previous = 1000;
        },
        { kind, target },
      );
      await page.keyboard.press('q');
      const result = await page.evaluate(async () => {
        const e = (window as any).__testEngine;
        let impact: any;
        for (let i = 0; i < 90; i++) {
          e.frame(e.previous + 1000 / 60);
          cancelAnimationFrame(e.frameId);
          impact = e.items.state.effects.find((effect: any) => effect.kind === 4);
          if (impact) break;
        }
        if (!impact) return { detonated: false };
        for (let i = 0; i < 18; i++) {
          e.frame(e.previous + 1000 / 60);
          cancelAnimationFrame(e.frameId);
        }
        const path = '/src/game/water.ts',
          { waterHeight } = await import(path);
        const x = impact.x - Math.sin(impact.yaw) * 7,
          z = impact.z - Math.cos(impact.yaw) * 7;
        return {
          detonated: true,
          explosions: (window as any).explosions.length,
          pulseCount: e.world.waterMaterial.uniforms.uPulseCount.value,
          displaced: Math.abs(
            waterHeight(x, z, e.visualTime, e.items.surface) -
              waterHeight(x, z, e.visualTime, e.track),
          ),
        };
      });
      expect(result.detonated).toBe(true);
      expect(result.explosions).toBe(1);
      expect(result.pulseCount).toBeGreaterThan(0);
      expect(result.displaced).toBeGreaterThan(0.15);
      await page.screenshot({ path: `artifacts/torpedo-${kind}-${target}-explosion.png` });
      expect(errors).toEqual([]);
    });
