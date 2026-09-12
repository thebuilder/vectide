import { expect, test } from '@playwright/test';

for (const mode of ['flip', 'dive'] as const)
  test(`water physics supports a controlled ${mode} entry`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/e2e/fixtures/coast.html');
    await page.waitForFunction(() => !!(window as any).demo);
    const result = await page.evaluate(async (mode) => {
      const e = (window as any).demo;
      cancelAnimationFrame(e.frameId);
      e.onFrame = () => {};
      e.start('race');
      e.state = 'racing';
      e.racers
        .slice(1)
        .forEach((r: any, i: number) => Object.assign(r, { x: 500 + i * 100, z: -500 }));
      const path = '/src/game/water.ts',
        { waterHeight } = await import(path),
        r = e.player;
      Object.assign(r, {
        x: -100,
        z: -150,
        y: waterHeight(-100, -150, 0, e.track) + (mode === 'dive' ? 3 : 0.5),
        vx: 0,
        vz: mode === 'dive' ? 20 : 0,
        vy: mode === 'dive' ? -2 : 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        wet: mode === 'dive' ? 0 : 1,
      });
      if (mode === 'dive') r.body.airtime = 0.3;
      else
        e.items.state.effects = [
          { id: 900, kind: 5, owner: 1, x: r.x, z: r.z - 12, yaw: 0, age: 0, hit: 0 },
        ];
      let released = false,
        maxRotation = 0,
        maxDive = 0,
        minDepth = Infinity,
        message = '';
      e.input = () => {
        if (r.body.airtime > 0.025) released = true;
        return {
          throttle: mode === 'dive' ? 1 : 0,
          brake: 0,
          steer: 0,
          lean:
            mode === 'dive'
              ? e.time < 1
                ? -1
                : 0
              : released && r.air.pitch < Math.PI * 2 - 0.6
                ? 1
                : 0,
          trick: mode === 'flip' && !released ? 1 : 0,
        };
      };
      e.previous = 1000;
      for (let i = 0; i < 60 * 5; i++) {
        e.frame(1000 + ((i + 1) * 1000) / 60);
        cancelAnimationFrame(e.frameId);
        maxRotation = Math.max(maxRotation, r.air.pitch);
        maxDive = Math.max(maxDive, r.air.dive);
        minDepth = Math.min(minDepth, r.y - waterHeight(r.x, r.z, e.visualTime, e.items.surface));
        if (r.air.message) message = r.air.message;
      }
      return {
        maxRotation,
        maxDive,
        minDepth,
        message,
        phase: r.recovery.phase,
        crashes: r.recovery.crashes,
        depth: r.y - waterHeight(r.x, r.z, e.visualTime, e.items.surface),
      };
    }, mode);
    console.log(mode, result);
    expect(result.crashes).toBe(0);
    expect(result.phase).toBe('riding');
    if (mode === 'flip') {
      expect(result.maxRotation).toBeGreaterThan(Math.PI * 2 - 0.1);
      expect(result.message).toBe('BACKFLIP LANDED');
    } else {
      expect(result.maxDive).toBeGreaterThan(0.1);
      expect(result.minDepth).toBeLessThan(-0.15);
      expect(result.depth).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
  });
