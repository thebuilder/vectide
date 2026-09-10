import { test, expect } from '@playwright/test';
test('weapon waves deform the ocean and CPU heights match the actual GPU shader', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => typeof (window as any).compareHeights === 'function');
  for (const kind of [1, 2, 3, 4, 5]) {
    await page.evaluate((kind) => (window as any).showPulse(kind), kind);
    const samples = await page.evaluate(() => (window as any).compareHeights());
    expect(Math.max(...samples.map((s: any) => Math.abs(s.cpu - s.gpu)))).toBeLessThan(0.002);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `artifacts/pickup-${kind === 4 ? 'shockwave' : 'wake'}-ocean.png`,
    });
  }
  expect(errors).toEqual([]);
});

test('mines float, torpedoes cut through waves, and weapons cast red light on the water', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => typeof (window as any).showWeapon === 'function');
  const poses = await page.evaluate(() =>
    [0, 1, 2, 3].map((time) => ({
      mine: (window as any).showWeapon(3, time),
      torpedo: (window as any).showWeapon(1, time),
    })),
  );
  for (const { mine, torpedo } of poses) {
    expect(mine.y - mine.surface).toBeCloseTo(0.7);
    expect(torpedo.y).toBe(-0.35);
  }
  expect(Math.max(...poses.map((p) => p.mine.tilt))).toBeGreaterThan(0.01);
  const glow = await page.evaluate(() => ({
    plain: (window as any).glowPixels(0),
    torpedo: (window as any).glowPixels(1),
    mine: (window as any).glowPixels(3, 0),
    beat: (window as any).glowPixels(3, 1),
    explosion: (window as any).glowPixels(4),
  }));
  expect(glow.torpedo.redPixels - glow.plain.redPixels).toBeGreaterThan(100);
  expect(glow.mine.redPixels - glow.plain.redPixels).toBeGreaterThan(100);
  expect(glow.beat.red).toBeGreaterThan(glow.mine.red * 1.5);
  expect(glow.explosion.redPixels).toBeGreaterThan(glow.torpedo.redPixels);
  for (const kind of [1, 3]) {
    await page.evaluate((kind) => (window as any).showWeapon(kind), kind);
    await page.screenshot({ path: `artifacts/weapon-${kind === 1 ? 'torpedo' : 'mine'}-glow.png` });
  }
  await page.locator('#detonate').click();
  await expect.poll(() => page.evaluate(() => (window as any).noiseStarts)).toBe(1);
  const burst = await page.evaluate(() => (window as any).demo.spray.activeCount);
  expect(burst).toBe(140);
  await page.screenshot({ path: 'artifacts/weapon-explosion-spray.png' });
  await page.evaluate(() => {
    const { demo } = window as any;
    for (let i = 0; i < 10; i++) demo.pickupVisuals.update(demo.items, 3, true);
  });
  expect(await page.evaluate(() => (window as any).noiseStarts)).toBe(1);
  await page.evaluate(() => {
    const { demo } = window as any;
    demo.audio.mute();
    demo.state = 'racing';
    (window as any).showWeapon(4, 3, 0, 0);
    demo.state = 'paused';
  });
  expect(await page.evaluate(() => (window as any).noiseStarts)).toBe(1);
  expect(errors).toEqual([]);
});

test('mine toss grows visibly in the chase camera and wake release splashes once', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/e2e/fixtures/pickup-water.html');
  await page.waitForFunction(() => typeof (window as any).startDeployment === 'function');
  for (const speed of [0, 32]) {
    const initial = await page.evaluate(
      (speed) => (window as any).startDeployment(3, speed),
      speed,
    );
    expect(initial.scale).toBe(0.25);
    let lastScale = initial.scale;
    for (const age of [0.14, 0.28, 0.56]) {
      const pose = await page.evaluate((age) => (window as any).advanceDeployment(age), age);
      expect(Math.abs(pose.x)).toBeLessThan(1);
      expect(Math.abs(pose.y)).toBeLessThan(1);
      expect(pose.scale).toBeGreaterThan(lastScale);
      lastScale = pose.scale;
      if (age === 0.56) expect(pose.height - pose.sea).toBeCloseTo(0.7);
      await page.waitForTimeout(100);
      await page.screenshot({ path: `artifacts/mine-toss-${speed}-${age}.png` });
    }
  }
  const particles = await page.evaluate(() => (window as any).demo.spray.activeCount);
  await page.evaluate(() => (window as any).startDeployment(6, 32));
  expect(await page.evaluate(() => (window as any).demo.spray.activeCount)).toBe(particles + 42);
  for (const age of [0.08, 0.2, 0.4, 0.7]) {
    await page.evaluate((age) => (window as any).advanceDeployment(age), age);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `artifacts/wake-release-${age}.png` });
  }
  expect(await page.evaluate(() => (window as any).releaseSplashes)).toBe(3);
  expect(errors).toEqual([]);
});
