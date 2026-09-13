import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`shows Storm's turn before the first checkpoint at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(30000);
    await page.setViewportSize(viewport);
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
    await page.locator('[data-track="2"]').click();
    await page.locator('#start').click();
    await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
    await page.screenshot({ path: `artifacts/storm-wayfinding-grid-${viewport.width}.png` });
    await page.keyboard.down('w');
    await page.waitForFunction(() => {
      const e = (window as any).__testEngine;
      const gate = e.track.gates[1];
      return e.player.nextGate === 1 && Math.hypot(e.player.x - gate.x, e.player.z - gate.z) < 45;
    });
    const approach = await page.evaluate(() => {
      const e = (window as any).__testEngine;
      cancelAnimationFrame(e.frameId);
      const board = e.scene.getObjectByName('West approach turn board');
      const projected = [-12, 12].flatMap((x) =>
        [1.5, 8.5].map((y) =>
          board.localToWorld(board.position.clone().set(x, y, 0.45)).project(e.camera),
        ),
      );
      let guides = 0;
      e.scene.traverse((object: any) => {
        if (object.name === 'Course guide post') guides++;
      });
      return {
        passed: e.player.passed,
        nextGate: e.player.nextGate,
        side: e.player.x - e.track.gates[1].x,
        left: Math.min(...projected.map((p: any) => p.x)),
        right: Math.max(...projected.map((p: any) => p.x)),
        top: Math.max(...projected.map((p: any) => p.y)),
        bottom: Math.min(...projected.map((p: any) => p.y)),
        depth: projected[0].z,
        guides,
      };
    });
    expect(approach.passed).toBe(1);
    expect(approach.nextGate).toBe(1);
    expect(Math.abs(approach.side)).toBeLessThan(20);
    expect(approach.guides).toBeGreaterThan(50);
    expect(approach.left).toBeGreaterThan(-0.95);
    expect(approach.right).toBeLessThan(0.95);
    expect(approach.bottom).toBeGreaterThan(-0.95);
    expect(approach.top).toBeLessThan(0.8);
    expect(approach.depth).toBeGreaterThan(-1);
    expect(approach.depth).toBeLessThan(1);
    await page.screenshot({ path: `artifacts/storm-wayfinding-before-gate-${viewport.width}.png` });
    await page.evaluate(() => {
      const e = (window as any).__testEngine;
      e.frame(performance.now());
    });
    await page.waitForFunction(() => (window as any).__vectide.player.passed >= 2);
    await page.keyboard.up('w');
    const result = await page.evaluate(() => ({
      crashes: (window as any).__vectide.player.recovery.crashes,
      recovered: (window as any).__vectide.player.recovered,
    }));
    expect(result).toEqual({ crashes: 0, recovered: false });
    expect(errors).toEqual([]);
  });
}
