import { test, expect } from '@playwright/test';

test('pickup grows, spins out after collection, and grows again on respawn', async ({ page }) => {
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => !!(window as any).demo);
  const result = await page.evaluate(async () => {
    const pickupPath = '/src/game/pickups.ts',
      waterPath = '/src/game/water.ts';
    const { Pickups, RESPAWN } = await import(pickupPath);
    const { waterHeight } = await import(waterPath);
    const engine = (window as any).demo;
    engine.items = new Pickups(engine.track, true);
    const items = engine.items,
      visuals = engine.pickupVisuals;
    const sample = (time: number) => {
      visuals.update(items, time, true);
      const mesh = visuals.group.children[0].children[0];
      return { visible: mesh.visible, scale: mesh.scale.x, spin: mesh.rotation.y };
    };
    const spawn = sample(10),
      growing = sample(10.125),
      ready = sample(10.3);
    const box = items.boxes[0];
    Object.assign(engine.player, {
      x: box.x,
      z: box.z,
      y: waterHeight(box.x, box.z, 10.3, engine.track) + 1,
      item: 0,
    });
    items.step(1 / 120, 10.3, [engine.player]);
    const awarded = engine.player.item;
    const collected = sample(10.3),
      shrinking = sample(10.39),
      gone = sample(10.5);
    const cooldown = items.state.cooldowns[0];
    // Repeated state snapshots must not restart the exit animation.
    items.state = { ...items.state, cooldowns: [...items.state.cooldowns] };
    const stillGone = sample(11);
    items.step(RESPAWN, 17.3, []);
    const respawn = sample(17.3),
      regrowing = sample(17.425),
      restored = sample(17.6);
    return {
      spawn,
      growing,
      ready,
      awarded,
      collected,
      shrinking,
      gone,
      cooldown,
      stillGone,
      respawn,
      regrowing,
      restored,
    };
  });
  expect(result.spawn.scale).toBeLessThan(0.05);
  expect(result.growing.scale).toBeGreaterThan(0.2);
  expect(result.growing.scale).toBeLessThan(0.9);
  expect(result.ready).toEqual({ visible: true, scale: 1, spin: 0 });
  expect(result.awarded).toBeGreaterThan(0);
  expect(result.cooldown).toBeGreaterThan(6);
  expect(result.collected.visible).toBe(true);
  expect(result.shrinking.scale).toBeGreaterThan(0);
  expect(result.shrinking.scale).toBeLessThan(0.8);
  expect(result.shrinking.spin).toBeGreaterThan(1);
  expect(result.gone.visible).toBe(false);
  expect(result.stillGone.visible).toBe(false);
  expect(result.respawn.scale).toBeLessThan(0.05);
  expect(result.regrowing.scale).toBeGreaterThan(0.2);
  expect(result.regrowing.scale).toBeLessThan(0.9);
  expect(result.restored).toEqual(result.ready);
});

test('reduced motion fades pickups without the extra spin or scaling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => !!(window as any).demo);
  const result = await page.evaluate(async () => {
    const path = '/src/game/pickups.ts';
    const { Pickups } = await import(path);
    const engine = (window as any).demo;
    engine.items = new Pickups(engine.track, true);
    const visuals = engine.pickupVisuals;
    const sample = (time: number) => {
      visuals.update(engine.items, time, true, 0, true);
      const mesh = visuals.group.children[0].children[0];
      return {
        visible: mesh.visible,
        scale: mesh.scale.x,
        spin: mesh.rotation.y,
        opacity: mesh.children[0].material.opacity,
      };
    };
    const spawn = sample(10),
      growing = sample(10.125),
      ready = sample(10.3);
    engine.items.state.cooldowns[0] = 7;
    sample(10.3);
    const shrinking = sample(10.39),
      gone = sample(10.5);
    return { spawn, growing, ready, shrinking, gone };
  });
  for (const state of Object.values(result)) {
    expect(state.scale).toBe(1);
    expect(state.spin).toBe(0);
  }
  expect(result.spawn.opacity).toBe(0);
  expect(result.growing.opacity).toBeGreaterThan(0);
  expect(result.growing.opacity).toBeLessThan(1);
  expect(result.ready.opacity).toBe(1);
  expect(result.shrinking.opacity).toBeGreaterThan(0);
  expect(result.shrinking.opacity).toBeLessThan(1);
  expect(result.gone.visible).toBe(false);
});

test('a fresh race resets animation and joining a collected pickup does not replay collection', async ({
  page,
}) => {
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => !!(window as any).demo);
  const result = await page.evaluate(async () => {
    const path = '/src/game/pickups.ts';
    const { Pickups } = await import(path);
    const engine = (window as any).demo;
    const visuals = engine.pickupVisuals;
    const sample = (time: number) => {
      visuals.update(engine.items, time, true);
      const mesh = visuals.group.children[0].children[0];
      return { visible: mesh.visible, scale: mesh.scale.x, spin: mesh.rotation.y };
    };
    engine.items = new Pickups(engine.track, true);
    engine.items.state.cooldowns[0] = 5;
    const joined = sample(10),
      later = sample(10.1);
    engine.items = new Pickups(engine.track, true);
    const restarted = sample(0),
      ready = sample(0.3);
    engine.items.state.cooldowns[0] = 7;
    sample(0.3);
    sample(0.4);
    engine.items.state.cooldowns[0] = 0;
    const rewound = sample(0);
    return { joined, later, restarted, ready, rewound };
  });
  expect(result.joined.visible).toBe(false);
  expect(result.later.visible).toBe(false);
  expect(result.restarted.scale).toBeLessThan(0.05);
  expect(result.ready).toEqual({ visible: true, scale: 1, spin: 0 });
  expect(result.rewound).toEqual(result.restarted);
});

test('distant pickup rows fade into view without changing their availability', async ({ page }) => {
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => !!(window as any).demo);
  const samples = await page.evaluate(async () => {
    const path = '/src/game/pickups.ts';
    const { Pickups } = await import(path);
    const e = (window as any).demo;
    const items = new Pickups(e.track, true),
      box = items.boxes[0];
    return [false, true].map((reduced) =>
      [120, 82.5, 60].map((distance, i) => {
        e.pickupVisuals.update(items, 10 + i, true, 0, reduced, { x: box.x + distance, z: box.z });
        const mesh = e.pickupVisuals.group.children[0].children[0];
        return {
          visible: mesh.visible,
          opacity: mesh.children[0].material.opacity,
          cooldown: items.state.cooldowns[0],
        };
      }),
    );
  });
  for (const [far, approaching, nearby] of samples) {
    expect(far.visible).toBe(false);
    expect(far.opacity).toBe(0);
    expect(approaching.visible).toBe(true);
    expect(approaching.opacity).toBeCloseTo(0.5);
    expect(nearby.opacity).toBe(1);
    expect([far.cooldown, approaching.cooldown, nearby.cooldown]).toEqual([0, 0, 0]);
  }
});
