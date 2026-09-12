import { expect, test } from '@playwright/test';

for (const hz of [60, 120, 144, 240])
  test(`ramp approach, flight and landing move on every display frame at ${hz} Hz`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto('/e2e/fixtures/coast.html');
    await page.waitForFunction(() => !!(window as any).demo);
    const result = await page.evaluate(async (hz) => {
      const e = (window as any).demo;
      cancelAnimationFrame(e.frameId);
      e.onFrame = () => {};
      e.start('trial');
      e.state = 'racing';
      const p = e.player,
        ramp = e.track.ramps[0];
      Object.assign(p, {
        x: ramp.x - ramp.tx * 18,
        z: ramp.z - ramp.tz * 18,
        yaw: Math.atan2(ramp.tx, ramp.tz),
        vx: ramp.tx * 22,
        vz: ramp.tz * 22,
        nextGate: ramp.targetGate,
      });
      const path = '/src/game/water.ts';
      const { waterHeight } = await import(path);
      p.y = waterHeight(p.x, p.z, 0, e.track) + 0.6;
      e.input = () => ({ throttle: 1, steer: 0, brake: 0, lean: 0 });
      let now = 1000,
        repeated = 0,
        onRamp = 0,
        airborne = 0,
        landed = false;
      e.previous = now;
      let previous: number[] | undefined;
      const frames = [];
      for (let i = 0; i < hz * 7; i++) {
        // Display timing varies around the fixed physics boundary.
        now += 1000 / hz + (i % 2 ? 0.8 : -0.8);
        e.frame(now);
        cancelAnimationFrame(e.frameId);
        const jet = e.jets[0];
        const position = jet.position.toArray();
        if (
          i > 2 &&
          previous &&
          Math.hypot(
            position[0] - previous[0],
            position[1] - previous[1],
            position[2] - previous[2],
          ) < 1e-8
        )
          repeated++;
        previous = position;
        if (p.onRamp) onRamp++;
        if (onRamp && !p.onRamp && p.wet === 0) airborne++;
        if (airborne > 10 && p.wet > 0) landed = true;
        if (i % 120 === 0) frames.push({ t: e.time, y: p.y, ramp: p.onRamp, wet: p.wet });
      }
      return { repeated, onRamp, airborne, landed, frames, pose: e.riderPose };
    }, hz);
    console.log(hz, result);
    expect(result.onRamp).toBeGreaterThan(10);
    expect(result.airborne).toBeGreaterThan(30);
    expect(result.landed).toBe(true);
    expect(result.repeated).toBe(0);
    expect(Math.max(...result.pose.handErrors, ...result.pose.footErrors)).toBeLessThan(0.005);
  });
