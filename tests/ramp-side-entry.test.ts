import { expect, it } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import { createRacer, stepRacer } from '../src/game/physics';
it.each([-1, 1])('rejects side %s contact already inside the hull-width boundary', (side) => {
  const track = { ...TRACKS[0], wave: 0, obstacles: [] },
    ramp = track.ramps[0],
    r = createRacer(track, 0);
  const sx = -ramp.tz * side,
    sz = ramp.tx * side;
  // A glancing approach or another racer can put the hull inside the expanded wall first.
  Object.assign(r, {
    x: ramp.x + ramp.tx * (ramp.length * 0.3) + sx * (ramp.width / 2 + 0.2),
    z: ramp.z + ramp.tz * (ramp.length * 0.3) + sz * (ramp.width / 2 + 0.2),
    y: 0.5,
    vx: -sx * 20,
    vz: -sz * 20,
    yaw: Math.atan2(-sx, -sz),
  });
  for (let frame = 0; frame < 30; frame++) {
    const y = r.y;
    stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, frame / 120, 1 / 120);
    expect(r.y - y).toBeLessThan(0.1);
    expect(r.onRamp).toBe(false);
  }
  expect((r.x - ramp.x) * sx + (r.z - ramp.z) * sz).toBeGreaterThan(ramp.width / 2);
});

it('a descending rider can still land on the deck from above', () => {
  const track = { ...TRACKS[0], wave: 0, obstacles: [] },
    ramp = track.ramps[0],
    r = createRacer(track, 0);
  const top = ramp.baseHeight + (0.3 + 0.5) * ramp.height;
  Object.assign(r, {
    x: ramp.x + ramp.tx * (ramp.length * 0.3),
    z: ramp.z + ramp.tz * (ramp.length * 0.3),
    y: top + 0.6,
    vy: -30,
  });
  const before = { x: r.x, z: r.z };
  stepRacer(r, { throttle: 0, steer: 0, brake: 0, lean: 0 }, track, 0, 1 / 120);
  expect(r.onRamp).toBe(true);
  expect(r.y).toBeCloseTo(top + 0.52);
  expect(r.x).toBeCloseTo(before.x);
  expect(r.z).toBeCloseTo(before.z);
});
