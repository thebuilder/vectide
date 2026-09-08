import { it, expect } from 'vitest';
import { createRacer, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
it('crossing wave slopes changes heading and lateral motion without steering', () => {
  const run = (wave: number) => {
    const track = { ...TRACKS[0], wave, obstacles: [], ramps: [] },
      r = createRacer(track, 0);
    Object.assign(r, { x: 0, z: 0, y: 0.6, yaw: 0, vx: 0, vz: 15 });
    for (let i = 0; i < 240; i++)
      stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
    return r;
  };
  const flat = run(0),
    rough = run(2.3);
  expect(flat.x).toBe(0);
  expect(flat.yaw).toBe(0);
  expect(Math.abs(rough.x)).toBeGreaterThan(0.02);
  expect(Math.abs(rough.yaw)).toBeGreaterThan(0.001);
  expect(Math.abs(rough.yaw)).toBeLessThan(0.2);
});

it.each(TRACKS)('settles to a true stop without throttle on $name', (source) => {
  const track = { ...source, obstacles: [], ramps: [] },
    r = createRacer(track, 0);
  r.vx = Math.sin(r.yaw) * 22;
  r.vz = Math.cos(r.yaw) * 22;
  for (let i = 0; i < 120 * 20; i++)
    stepRacer(r, { throttle: 0, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
  expect(Math.hypot(r.vx, r.vz)).toBe(0);
  const position = { x: r.x, z: r.z };
  for (let i = 0; i < 120 * 10; i++)
    stepRacer(r, { throttle: 0, steer: 0, brake: 0, lean: 0 }, track, 20 + i / 120, 1 / 120);
  expect(r.x).toBe(position.x);
  expect(r.z).toBe(position.z);
});
