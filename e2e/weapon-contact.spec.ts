import { expect, test } from '@playwright/test';

for (const scenario of [
  { kind: 4, distance: 12, hits: 1 },
  { kind: 5, distance: 12, hits: 0 },
  { kind: 5, distance: 2, hits: 1 },
])
  test(`weapon crest ${scenario.kind} at ${scenario.distance}m keeps the shove separate from buoyancy`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/e2e/fixtures/coast.html');
    await page.waitForFunction(() => !!(window as any).demo);
    await page.evaluate(async ({ kind, distance }) => {
      const e = (window as any).demo;
      e.onFrame = () => {};
      e.start('race');
      e.state = 'racing';
      e.input = () => ({ throttle: 0, steer: 0, brake: 1, lean: 0 });
      e.racers
        .slice(1)
        .forEach((r: any, i: number) => Object.assign(r, { x: 500 + i * 100, z: -500 }));
      const r = e.player;
      const path = '/src/game/water.ts',
        { waterHeight } = await import(path);
      Object.assign(r, {
        x: -100,
        z: -150,
        y: waterHeight(-100, -150, 0, e.track) + 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        pitch: 0,
        roll: 0,
        yaw: 0,
        wet: 1,
      });
      e.items.state.effects = [
        { id: 900, kind, owner: 1, x: r.x, z: r.z - distance, yaw: 0, age: 0, hit: 0 },
      ];
      e.cameraAnchor.set(r.x, r.y, r.z);
      e.camera.position.set(r.x - 5, r.y + 3, r.z - 8);
      e.camTarget.set(r.x, r.y + 0.6, r.z + 4);
      const result = { hits: [] as any[], airFrames: 0, maxLift: 0, initialY: r.y };
      (window as any).contactResult = result;
      const step = e.items.step.bind(e.items);
      e.items.step = (dt: number, time: number, racers: any[]) => {
        const before = { vx: r.vx, vy: r.vy, vz: r.vz, y: r.y, wet: r.wet, onRamp: r.onRamp };
        step(dt, time, racers);
        const push = Math.hypot(r.vx - before.vx, r.vz - before.vz);
        if (push > 0)
          result.hits.push({
            push,
            wet: before.wet,
            onRamp: before.onRamp,
            verticalKick: r.vy - before.vy,
            heightSnap: r.y - before.y,
          });
        if (r.wet === 0 && !r.onRamp) result.airFrames++;
        result.maxLift = Math.max(result.maxLift, r.y - result.initialY);
      };
    }, scenario);
    await page.waitForFunction(() => (window as any).demo.time > 3);
    const result = await page.evaluate(() => (window as any).contactResult);
    console.log(scenario, result);
    if (scenario.hits) {
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].push).toBeGreaterThan(6);
      expect(result.hits[0].wet).toBeGreaterThan(0);
      expect(result.hits[0].onRamp).toBe(false);
      expect(result.hits[0].verticalKick).toBe(0);
      expect(result.hits[0].heightSnap).toBe(0);
    } else expect(result.hits).toHaveLength(0);
    expect(result.airFrames).toBeGreaterThan(5);
    expect(result.maxLift).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });
