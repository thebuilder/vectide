import { expect, it } from 'vitest';
import { Pickups } from '../src/game/pickups';
import { createRacer, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { waterHeight } from '../src/game/water';
import { wakeTravel } from '../src/game/water-pulses';

it.each([4, 5])('kind %i waves never apply a separate shove above the water', (kind) => {
  const items = new Pickups(TRACKS[0], true),
    r = createRacer(TRACKS[0], 1);
  Object.assign(r, { x: -100, z: -150, wet: 0, vx: 12, vy: -2, vz: 14 });
  items.state.effects = [0.3, 0.5, 0.7].map((age, i) => ({
    id: i + 1,
    kind,
    owner: 0,
    x: r.x,
    z: r.z - (kind === 4 ? age * 23 : wakeTravel(age)),
    yaw: 0,
    age,
    hit: 0,
  }));
  r.y = waterHeight(r.x, r.z, 0, items.surface) + 3;
  const before = structuredClone(r);
  items.step(1 / 120, 1 / 120, [r]);
  expect(r).toEqual(before);
});

it.each([4, 5])('kind %i waves shove on contact while buoyancy supplies the lift', (kind) => {
  const track = TRACKS[0],
    items = new Pickups(track, true);
  const rider = createRacer(track, 1),
    plain = createRacer(track, 1);
  for (const r of [rider, plain])
    Object.assign(r, {
      x: -100,
      z: -150,
      y: waterHeight(-100, -150, 0, track) + 0.5,
      yaw: 0,
    });
  items.state.effects = [{ id: 1, kind, owner: 0, x: -100, z: -162, yaw: 0, age: 0, hit: 0 }];
  let lift = 0,
    shove = 0,
    hits = 0;
  for (let i = 1; i <= 240; i++) {
    const dt = 1 / 120,
      t = i * dt,
      input = { throttle: 0, steer: 0, brake: 1, lean: 0 };
    stepRacer(rider, input, track, t, dt, 1, items.surface);
    stepRacer(plain, input, track, t, dt);
    const supported = structuredClone(rider);
    items.step(dt, t, [rider]);
    expect(rider.y).toBe(supported.y);
    expect(rider.vy).toBe(supported.vy);
    const push = Math.hypot(rider.vx - supported.vx, rider.vz - supported.vz);
    if (push > 0) {
      hits++;
      expect(supported.wet).toBeGreaterThan(0);
      expect(supported.onRamp).toBe(false);
      expect(rider.vz).toBeGreaterThan(supported.vz);
      shove = Math.max(shove, push);
    }
    lift = Math.max(lift, rider.y - plain.y);
  }
  expect(lift).toBeGreaterThan(1);
  expect(shove).toBeGreaterThan(6);
  expect(hits).toBe(1);
});

it.each([4, 5])('kind %i crests cannot shove a craft supported by a ramp', (kind) => {
  const items = new Pickups(TRACKS[0], true),
    r = createRacer(TRACKS[0], 1);
  Object.assign(r, { x: -100, z: -150, wet: 1, onRamp: true, vy: 4 });
  items.state.effects = [
    {
      id: 1,
      kind,
      owner: 0,
      x: r.x,
      z: r.z - (kind === 4 ? 0.5 * 23 : wakeTravel(0.5)),
      yaw: 0,
      age: 0.5,
      hit: 0,
    },
  ];
  const before = structuredClone(r);
  items.step(1 / 120, 1 / 120, [r]);
  expect(r).toEqual(before);
  expect(items.state.effects[0].hit).toBe(0);
});
