import { expect, test } from '@playwright/test';

for (const scenario of ['flip', 'spin', 'inverted'] as const)
  test(`${scenario} landing follows the craft attitude`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/e2e/fixtures/coast.html');
    await page.waitForFunction(() => !!(window as any).demo);
    await page.evaluate(async (scenario) => {
      const e = (window as any).demo;
      e.onFrame = () => {};
      e.start('trial');
      e.state = 'racing';
      e.input = () => ({ throttle: 1, steer: 0, brake: 0, lean: 0 });
      const r = e.player;
      const path = '/src/game/water.ts',
        { waterHeight } = await import(path);
      Object.assign(r, {
        x: -100,
        z: -150,
        y: waterHeight(-100, -150, 0, e.track) + 0.8,
        vx: 0,
        vy: -6,
        vz: 20,
        pitch: 0,
        roll: 0,
        yaw: 0,
        wet: 0,
      });
      r.body.airtime = 0.3;
      Object.assign(r.air, {
        armed: true,
        pitch: scenario === 'inverted' ? Math.PI : scenario === 'flip' ? 2 * Math.PI - 0.2 : 0,
        yaw: scenario === 'spin' ? 2 * Math.PI - 0.4 : 0,
      });
      e.cameraAnchor.set(r.x, r.y, r.z);
      e.camera.position.set(r.x - 4, r.y + 3, r.z - 8);
      e.camTarget.set(r.x, r.y + 0.6, r.z + 4);
      const step = e.items.step.bind(e.items);
      e.items.step = (dt: number, time: number, racers: any[]) => {
        step(dt, time, racers);
        if (!(window as any).landing && !r.air.armed && r.wet > 0)
          (window as any).landing = {
            phase: r.recovery.phase,
            pitch: r.pitch,
            yaw: r.yaw,
            speed: Math.hypot(r.vx, r.vz),
            message: r.air.message,
          };
      };
    }, scenario);
    await page.waitForFunction(() => !!(window as any).landing);
    const landing = await page.evaluate(() => (window as any).landing);
    console.log(scenario, landing);
    if (scenario === 'inverted') expect(landing.phase).toBe('falling');
    else {
      expect(landing.phase).toBe('riding');
      expect(landing.speed).toBeGreaterThan(14);
      expect(landing.speed).toBeLessThan(20);
      expect(landing.message).toBe(scenario === 'flip' ? 'BACKFLIP LANDED' : '360 SPIN LANDED');
      if (scenario === 'flip') {
        expect(Math.abs(landing.pitch)).toBeGreaterThan(0.01);
        expect(Math.abs(landing.pitch)).toBeLessThan(Math.PI / 4);
      } else {
        expect(landing.yaw).toBeLessThan(-0.1);
        expect(landing.yaw).toBeGreaterThan(-0.6);
        await page.waitForFunction(() => (window as any).demo.time > 1);
        expect(await page.evaluate(() => (window as any).demo.player.vx)).toBeLessThan(-0.1);
      }
    }
    expect(errors).toEqual([]);
  });
