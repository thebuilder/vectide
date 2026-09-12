import { expect, it } from 'vitest';
import { RideCamera } from '../src/game/ride-camera';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
it('compresses briefly on landing, settles, and clears on restart', () => {
  const camera = new RideCamera(),
    r = createRacer(TRACKS[0], 0);
  r.wet = 0;
  r.vy = -12;
  camera.update(1 / 60, r, false, false);
  r.wet = 1;
  const landing = camera.update(1 / 60, r, false, false);
  expect(landing.height).toBeGreaterThan(2.7);
  expect(landing.height).toBeLessThan(2.9);
  expect(camera.update(1, r, false, false).height).toBeCloseTo(2.9, 2);
  camera.clear();
  expect(camera.update(0, r, false, false).height).toBe(2.9);
});
it('eases into the finish and suppresses extra motion with reduced motion', () => {
  const camera = new RideCamera(),
    r = createRacer(TRACKS[0], 0);
  r.vx = 30;
  const start = camera.update(0.01, r, true, false);
  const end = camera.update(2, r, true, false);
  expect(start.yawOffset).toBeLessThan(0.001);
  expect(end.yawOffset).toBe(0.4);
  expect(end.distance).toBeGreaterThan(start.distance);
  const reduced = camera.update(1, r, true, true);
  expect(reduced).toEqual({ yawOffset: 0, distance: 7.2, height: 2.9, fov: 58 });
});
