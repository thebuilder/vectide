import { expect, it } from 'vitest';
import { Pickups, type ItemEffect } from '../src/game/pickups';
import { TRACKS, type Track } from '../src/game/tracks';
import { pulseHeight } from '../src/game/water-pulses';

function shoot(track: Track, kind: number, x: number, z: number, yaw: number, dt: number) {
  const items = new Pickups(track, true);
  const effect: ItemEffect = { id: 1, kind, owner: 0, x, z, yaw, age: 0, hit: 0 };
  items.state.effects.push(effect);
  items.step(dt, dt, []);
  return { items, effect };
}

for (const kind of [1, 2]) {
  it.each(TRACKS[0].ramps)('torpedo ' + kind + ' detonates on a ramp slope at $x, $z', (ramp) => {
    const start = ramp.length / 2 + 8;
    const { items, effect } = shoot(
      TRACKS[0],
      kind,
      ramp.x - ramp.tx * start,
      ramp.z - ramp.tz * start,
      Math.atan2(ramp.tx, ramp.tz),
      0.7,
    );
    expect(effect.kind).toBe(4);
    expect(Math.abs((effect.x - ramp.x) * ramp.tx + (effect.z - ramp.z) * ramp.tz)).toBeLessThan(
      ramp.length / 2,
    );
    expect(effect.age).toBe(0);
    expect(pulseHeight(effect.x + 7, effect.z, 0.3, items.surface.pulses![0])).toBeGreaterThan(1);
  });

  it.each(['side', 'rear'])(
    'torpedo ' + kind + ' hits the ramp %s without passing through',
    (side) => {
      const ramp = TRACKS[0].ramps[0],
        along = ramp.length / 2 - 1;
      const origin =
        side === 'rear'
          ? {
              x: ramp.x + ramp.tx * (ramp.length / 2 + 5),
              z: ramp.z + ramp.tz * (ramp.length / 2 + 5),
            }
          : {
              x: ramp.x + ramp.tx * along - ramp.tz * (ramp.width / 2 + 5),
              z: ramp.z + ramp.tz * along + ramp.tx * (ramp.width / 2 + 5),
            };
      const yaw = side === 'rear' ? Math.atan2(-ramp.tx, -ramp.tz) : Math.atan2(ramp.tz, -ramp.tx);
      const { effect } = shoot(TRACKS[0], kind, origin.x, origin.z, yaw, 0.5);
      expect(effect.kind).toBe(4);
      expect(Math.hypot(effect.x - origin.x, effect.z - origin.z)).toBeLessThan(5.1);
    },
  );

  it('torpedo ' + kind + ' catches a narrow obstacle crossed entirely in one step', () => {
    const track = {
      ...TRACKS[0],
      obstacles: [...TRACKS[0].obstacles, { x: -100, z: -140, radius: 1 }],
    };
    const { effect } = shoot(track, kind, -100, -150, 0, 0.5);
    expect(effect.kind).toBe(4);
    expect(effect.z).toBeLessThan(-140);
    expect(effect.z).toBeGreaterThan(-142);
  });

  it('torpedo ' + kind + ' catches a thin dock crossed entirely in one step', () => {
    const dock = {
      name: 'Test pier',
      kind: 'dock' as const,
      x: -100,
      z: -140,
      height: 3,
      outline: [
        { x: -105, z: -141 },
        { x: -95, z: -141 },
        { x: -95, z: -139 },
        { x: -105, z: -139 },
      ],
    };
    const { effect } = shoot(
      { ...TRACKS[0], land: [...TRACKS[0].land, dock] },
      kind,
      -100,
      -150,
      0,
      0.5,
    );
    expect(effect.kind).toBe(4);
    expect(effect.z).toBeLessThan(-141);
    expect(effect.z).toBeGreaterThan(-142);
  });

  it('torpedo ' + kind + ' clears the side of a ramp in open water', () => {
    const ramp = TRACKS[0].ramps[0],
      start = ramp.length / 2 + 5,
      side = ramp.width / 2 + 2;
    const { effect } = shoot(
      TRACKS[0],
      kind,
      ramp.x - ramp.tx * start - ramp.tz * side,
      ramp.z - ramp.tz * start + ramp.tx * side,
      Math.atan2(ramp.tx, ramp.tz),
      0.5,
    );
    expect(effect.kind).toBe(kind);
  });
}

it('detonates at the first contact rather than a later obstacle or racer', async () => {
  const { createRacer } = await import('../src/game/physics');
  const track = {
    ...TRACKS[0],
    obstacles: [...TRACKS[0].obstacles, { x: -100, z: -140, radius: 1 }],
  };
  for (const z of [-145, -135]) {
    const items = new Pickups(track, true),
      racer = createRacer(track, 1);
    Object.assign(racer, { x: -100, z, y: -0.35 });
    const effect: ItemEffect = {
      id: 1,
      kind: 1,
      owner: 0,
      x: -100,
      z: -150,
      yaw: 0,
      age: 0,
      hit: 0,
    };
    items.state.effects = [effect];
    items.step(0.5, 0.5, [racer]);
    expect(effect.kind).toBe(4);
    expect(effect.z).toBeCloseTo(z === -145 ? -146.3 : -141.35);
  }
});

it('does not collide with the submerged ramp nose before reaching its slope', () => {
  const ramp = TRACKS[0].ramps[0],
    start = ramp.length / 2 + 1;
  const { effect } = shoot(
    TRACKS[0],
    1,
    ramp.x - ramp.tx * start,
    ramp.z - ramp.tz * start,
    Math.atan2(ramp.tx, ramp.tz),
    0.04,
  );
  expect(effect.kind).toBe(1);
  expect((effect.x - ramp.x) * ramp.tx + (effect.z - ramp.z) * ramp.tz).toBeGreaterThan(
    -ramp.length / 2,
  );
});
