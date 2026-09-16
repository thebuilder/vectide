import { expect, test } from '@playwright/test';

for (const course of [
  { index: 0, id: 'palms', gates: 5, views: ['Reef entrance', 'Outer reef'] },
  { index: 1, id: 'harbor', gates: 7, views: ['Inner basin', 'Southwest basin'] },
]) {
  test(`${course.id} keeps its revised gates and pickups on a complete rendered racing lap`, async ({
    page,
  }) => {
    test.setTimeout(100000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('vectide:driving-tips:v1', '{"keyboard":15}');
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
    await page.locator(`[data-track="${course.index}"]`).click();
    await page.locator('#start').click();
    await page.waitForFunction(() => (window as any).__vectide?.state === 'racing');
    const setup = await page.evaluate(async () => {
      const path = '/src/game/physics.ts';
      const { aiInput } = await import(path);
      const e = (window as any).__testEngine;
      e.input = () => aiInput(e.player, e.track, e.racers);
      const audit = { gates: [] as string[], frames: [] as number[], retries: 0 };
      (window as any).__courseAudit = audit;
      let previous = performance.now();
      let retrying = false;
      const inspect = (now: number) => {
        if (e.player.laps.length) return;
        const name = e.track.gates[e.player.nextGate].name;
        if (!audit.gates.includes(name)) audit.gates.push(name);
        if (e.player.approachingGate && !retrying) audit.retries++;
        retrying = e.player.approachingGate;
        audit.frames.push(now - previous);
        previous = now;
        requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
      return { gates: e.track.gates.length, pickups: e.items.boxes.length };
    });
    expect(setup).toEqual({ gates: course.gates, pickups: course.id === 'palms' ? 25 : 15 });
    for (const [index, name] of course.views.entries()) {
      await page.waitForFunction(
        (name) => {
          const e = (window as any).__testEngine;
          const gate = e.track.gates[e.player.nextGate];
          return gate.name === name && Math.hypot(e.player.x - gate.x, e.player.z - gate.z) < 65;
        },
        name,
        { timeout: 70000 },
      );
      await page.screenshot({ path: `artifacts/course-flow-${course.id}-${index}.png` });
    }
    await page.waitForFunction(() => (window as any).__vectide.player.laps.length > 0, undefined, {
      timeout: 70000,
    });
    const result = await page.evaluate(() => {
      const e = (window as any).__testEngine;
      const audit = (window as any).__courseAudit;
      const frames = audit.frames.sort((a: number, b: number) => a - b);
      return {
        lap: e.player.laps[0],
        recovered: e.player.recovered,
        crashes: e.player.recovery.crashes,
        gates: audit.gates.length,
        retries: audit.retries,
        frameP95: frames[Math.floor(frames.length * 0.95)],
      };
    });
    expect(result.lap).toBeGreaterThan(45);
    expect(result.lap).toBeLessThan(80);
    expect(result.gates).toBe(course.gates);
    expect(result.recovered).toBe(false);
    expect(result.crashes).toBe(0);
    expect(result.retries).toBe(0);
    if (process.env.PLAYWRIGHT_GPU) expect(result.frameP95).toBeLessThan(34);
    expect(errors).toEqual([]);
    console.log(course.id, result);
  });
}
