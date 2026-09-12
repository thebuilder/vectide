import { expect, it } from 'vitest';
import { createRacer } from '../src/game/physics';
import { PHYSICS_STEP, RacerPresentation } from '../src/game/racer-presentation';
import { TRACKS } from '../src/game/tracks';

it.each([60, 120, 144, 240])('keeps constant motion even between physics ticks at %i Hz', (hz) => {
  const r = createRacer(TRACKS[0], 0),
    poses = new RacerPresentation();
  r.x = r.y = r.z = 0;
  r.vx = 22;
  r.vy = 5;
  let accumulator = 0,
    elapsed = 0;
  for (let i = 0; i < hz * 2; i++) {
    const dt = 1 / hz + (i % 2 ? 0.0008 : -0.0008);
    elapsed += dt;
    accumulator += dt;
    while (accumulator >= PHYSICS_STEP) {
      poses.capture([r]);
      r.x += r.vx * PHYSICS_STEP;
      r.y += r.vy * PHYSICS_STEP;
      accumulator -= PHYSICS_STEP;
    }
    if (!poses.ready) continue;
    const authoritative = structuredClone(r);
    const drawn = poses.render(r, accumulator / PHYSICS_STEP);
    expect(drawn.x).toBeCloseTo(22 * (elapsed - PHYSICS_STEP), 9);
    expect(drawn.y).toBeCloseTo(5 * (elapsed - PHYSICS_STEP), 9);
    expect(r).toEqual(authoritative);
  }
});

it('keeps body load and velocity continuous and wraps completed tricks without a reverse spin', () => {
  const r = createRacer(TRACKS[0], 0),
    poses = new RacerPresentation();
  r.yaw = Math.PI - 0.02;
  r.air.pitch = Math.PI * 2 - 0.02;
  poses.capture([r]);
  const before = structuredClone(r);
  r.yaw = -Math.PI + 0.02;
  r.air.pitch = 0;
  r.body.compression = 0.3;
  r.vy = -8;
  const drawn = poses.render(r, 0.5);
  expect(drawn.yaw).toBeCloseTo(Math.PI);
  expect(drawn.air.pitch).toBeCloseTo(Math.PI * 2 - 0.01);
  expect(drawn.body.compression).toBeCloseTo((before.body.compression + 0.3) / 2);
  expect(drawn.vy).toBeCloseTo((before.vy - 8) / 2);
  expect(drawn.body).not.toBe(r.body);
});

it('holds the pose while the simulation is paused and discards history on restart', () => {
  const r = createRacer(TRACKS[0], 0),
    poses = new RacerPresentation();
  poses.capture([r]);
  r.x += 0.2;
  const paused = structuredClone(poses.render(r, 0.4));
  for (let i = 0; i < 120; i++) expect(poses.render(r, 0.4)).toEqual(paused);
  poses.clear();
  expect(poses.ready).toBe(false);
  expect(poses.render(r, 0)).toBe(r);
});

it('snaps to recovered or teleported riders and never reuses history for a new race', () => {
  const r = createRacer(TRACKS[0], 0),
    poses = new RacerPresentation();
  poses.capture([r]);
  r.recovered = true;
  expect(poses.render(r, 0)).toBe(r);
  poses.capture([r]);
  r.y += 9;
  expect(poses.render(r, 0.5)).toBe(r);
  const replacement = createRacer(TRACKS[0], 0);
  expect(poses.render(replacement, 0.5)).toBe(replacement);
});
