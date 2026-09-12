import { test, expect } from '@playwright/test';

test('Storm shows the first gate from the grid and admits a straight launch before the turn', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + '\nwindow.__testEngine = engine;',
    });
  });
  await page.goto('/');
  await page.locator('#open-setup').click();
  await page.locator('[data-track="2"]').click();
  await page.locator('#start').click();
  await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
  const opening = await page.evaluate(async () => {
    const path = '/node_modules/.vite/deps/three.js';
    const { Vector3 } = await import(path);
    const e = (window as any).__testEngine,
      first = e.track.gates[1];
    const y = e.world.gates[1].position.y;
    const project = (x: number, y: number, z: number) =>
      new Vector3(x, y, z).project(e.camera).toArray();
    return {
      posts: e.world.gates[1].children
        .filter((child: any) => child.name === 'buoy')
        .map((buoy: any) =>
          project(first.x + buoy.position.x, y + buoy.position.y + 3, first.z + buoy.position.z),
        ),
      crates: e.pickupVisuals.group.children[0].children
        .filter((mesh: any) => mesh.visible)
        .map((mesh: any) => project(mesh.position.x, mesh.position.y, mesh.position.z)),
    };
  });
  for (const [x, y, z] of opening.posts) {
    expect(Math.abs(x)).toBeLessThan(0.95);
    expect(Math.abs(y)).toBeLessThan(0.95);
    expect(Math.abs(z)).toBeLessThan(1);
  }
  expect(Math.abs(opening.posts[0][0] - opening.posts[1][0])).toBeGreaterThan(0.25);
  expect(
    opening.crates.filter(
      ([x, y, z]: number[]) => Math.abs(x) < 1 && Math.abs(y) < 1 && Math.abs(z) < 1,
    ),
  ).toHaveLength(0);
  await page.screenshot({ path: 'artifacts/storm-readable-opening.png' });
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vectide.player.nextGate === 2, undefined, {
    timeout: 10000,
  });
  await page.keyboard.up('w');
  const progress = await page.evaluate(() => ({
    passed: (window as any).__vectide.player.passed,
    recovered: (window as any).__vectide.player.recovered,
  }));
  expect(progress.passed).toBeGreaterThanOrEqual(2);
  expect(progress.recovered).toBe(false);
});
