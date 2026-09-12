import { expect, test } from '@playwright/test';

test('a ramp flip has a small airborne plume that recovers on landing', async ({ page }) => {
  await page.goto('/e2e/fixtures/coast.html');
  await page.waitForFunction(() => !!(window as any).demo);
  const result = await page.evaluate(async () => {
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
    let touchedRamp = false,
      flipped = false,
      deckLength = 0,
      airLength = Infinity,
      landingLength = 0,
      landedAt = 0;
    e.input = () => ({
      throttle: 1,
      steer: 0,
      brake: 0,
      lean: 0,
      trick: !touchedRamp || p.onRamp ? -1 : 0,
    });
    e.previous = 1000;
    for (let i = 0; i < 60 * 4; i++) {
      e.frame(1000 + ((i + 1) * 1000) / 60);
      cancelAnimationFrame(e.frameId);
      const plume = e.jets[0].getObjectByName('jet-exhaust');
      if (p.onRamp) {
        touchedRamp = true;
        deckLength = Math.max(deckLength, plume.scale.z);
      }
      if (p.air.trick === 'flip' && p.air.progress > 0.4 && p.air.progress < 0.7) {
        flipped = true;
        airLength = Math.min(airLength, plume.scale.z);
      }
      if (flipped && p.wet > 0) {
        if (!landedAt) landedAt = e.time;
        if (e.time - landedAt > 0.35) landingLength = Math.max(landingLength, plume.scale.z);
      }
    }
    return { flipped, deckLength, airLength, landingLength, phase: p.recovery.phase };
  });
  expect(result.flipped).toBe(true);
  expect(result.airLength).toBeLessThan(result.deckLength * 0.2);
  expect(result.landingLength).toBeGreaterThan(result.deckLength * 0.7);
  expect(result.phase).toBe('riding');
});
