import { expect, it } from 'vitest';
import { steerDolphin, type DolphinAgent } from '../src/game/dolphin-ai';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';

const swimmer = (x = 0): DolphinAgent => ({
  x,
  z: 16,
  vx: 0,
  vz: 20,
  yaw: 0,
  turnRate: 0,
  mode: 'escort',
  side: 5,
  lead: 16,
  targetId: null,
  interestUntil: 10,
  departAt: Infinity,
});
const rider = (id: number, x: number) =>
  Object.assign(createRacer(TRACKS[0], id), {
    x,
    z: 0,
    vx: 0,
    vz: 20,
  });

it('lets different dolphins choose nearby riders and change companions when one stops', () => {
  const a = swimmer(-20),
    b = swimmer(20),
    left = rider(0, -20),
    right = rider(1, 20);
  steerDolphin(a, [a, b], [left, right], () => true, 1, 0.1);
  steerDolphin(b, [a, b], [left, right], () => true, 1, 0.1);
  expect(a.targetId).toBe(left.id);
  expect(b.targetId).toBe(right.id);
  left.vz = 0;
  steerDolphin(a, [a, b], [left, right], () => true, 2, 0.1);
  expect(a.targetId).toBe(right.id);
  expect(a.departAt).toBe(Infinity);
});

it('steers toward the rider actual position instead of replaying the same path', () => {
  const a = swimmer(),
    b = swimmer();
  steerDolphin(a, [a], [rider(0, -15)], () => true, 1, 0.1);
  steerDolphin(b, [b], [rider(0, 15)], () => true, 1, 0.1);
  expect(a.vx).toBeLessThan(0);
  expect(b.vx).toBeGreaterThan(0);
});

it('steers away from a blocked water path and separates from nearby swimmers', () => {
  const a = swimmer(),
    neighbor = swimmer(-2),
    r = rider(0, 0);
  for (let frame = 0; frame < 240; frame++) {
    steerDolphin(a, [a, neighbor], [r], (x, z) => z < 25 || x > 5, frame / 60, 1 / 60);
    a.x += a.vx / 60;
    a.z += a.vz / 60;
    expect(a.z < 25 || a.x > 5).toBe(true);
  }
  expect(a.x).toBeGreaterThan(5);
});

it('keeps takeoff velocity fixed in the air and leaves when no rider remains nearby', () => {
  const a = swimmer();
  steerDolphin(a, [a], [rider(0, 15)], () => true, 1, 0);
  expect([a.vx, a.vz]).toEqual([0, 20]);
  steerDolphin(a, [a], [rider(0, 200)], () => true, 2, 0.1);
  expect(a.targetId).toBeNull();
  expect(a.departAt).toBe(2);
});
