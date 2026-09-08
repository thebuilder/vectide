import { describe, it, expect } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import { waterHeight, vertexHeight, CELL } from '../src/game/water';
import {
  aiInput,
  catchupPower,
  collideRacers,
  createRacer,
  crossesGate,
  stepRacer,
  updateProgress,
} from '../src/game/physics';

describe('water and hull', () => {
  it('matches rendered grid vertices and stays continuous across cell boundaries', () => {
    for (let x = -24; x <= 24; x += CELL)
      for (let z = -24; z <= 24; z += CELL)
        expect(waterHeight(x, z, 1.3, 2.3)).toBeCloseTo(vertexHeight(x, z, 1.3, 2.3), 10);
    expect(waterHeight(4 - 0.00001, 3, 2, 1)).toBeCloseTo(waterHeight(4 + 0.00001, 3, 2, 1), 4);
  });
  it.each(TRACKS)('floats stably on $name for 30 seconds', (track) => {
    const r = createRacer(track, 0);
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < 3600; i++) {
      stepRacer(r, { throttle: 0, brake: 0, steer: 0, lean: 0 }, track, i / 120, 1 / 120);
      min = Math.min(min, r.y);
      max = Math.max(max, r.y);
      expect(Number.isFinite(r.y)).toBe(true);
    }
    expect(min).toBeGreaterThan(-4);
    expect(max).toBeLessThan(5);
    expect(Math.abs(r.roll)).toBeLessThan(0.9);
  });
  it('leaves the water and follows gravity when airborne', () => {
    const r = createRacer(TRACKS[0], 0);
    r.y = 20;
    r.vy = 3;
    stepRacer(r, { throttle: 1, brake: 0, steer: 0, lean: 0 }, TRACKS[0], 0, 1 / 120);
    expect(r.wet).toBe(0);
    expect(r.vy).toBeCloseTo(3 - 9.81 / 120);
    expect(r.vx).toBe(0);
  });
});
describe('fair racing', () => {
  it('resolves racer impact with equal impulses and no added kinetic energy', () => {
    const a = createRacer(TRACKS[0], 0),
      b = createRacer(TRACKS[0], 1);
    Object.assign(a, { x: 0, z: 0, y: 0, vx: 10, vz: 0 });
    Object.assign(b, { x: 2, z: 0, y: 0, vx: 0, vz: 0 });
    expect(collideRacers(a, b)).toBe(true);
    expect(a.vx + b.vx).toBeCloseTo(10);
    expect(a.vx * a.vx + b.vx * b.vx).toBeLessThan(100);
    expect(b.x - a.x).toBeCloseTo(2.7);
  });
  it('requires directional crossing inside the gate and rejects a skipped gate', () => {
    const g = { x: 0, z: 0, tx: 0, tz: 1, width: 20 };
    expect(crossesGate({ x: 0, z: -2 }, { x: 0, z: 2 }, g)).toBe(true);
    expect(crossesGate({ x: 0, z: 2 }, { x: 0, z: -2 }, g)).toBe(false);
    expect(crossesGate({ x: 11, z: -2 }, { x: 11, z: 2 }, g)).toBe(false);
    const track = TRACKS[0],
      r = createRacer(track, 0),
      other = track.gates[3];
    r.x = other.x + other.tx;
    r.z = other.z + other.tz;
    expect(updateProgress(r, { x: other.x - other.tx, z: other.z - other.tz }, track, 1, 1)).toBe(
      false,
    );
    expect(r.passed).toBe(0);
  });
  it('limits catch-up to two trailing racers with a 12 percent power cap', () => {
    const track = TRACKS[0],
      p = createRacer(track, 0);
    p.passed = 30;
    for (let i = 1; i < 6; i++) {
      const r = createRacer(track, i);
      expect(catchupPower(r, p, track)).toBe(i < 3 ? 1.12 : 1);
      r.passed = 40;
      expect(catchupPower(r, p, track)).toBe(1);
    }
  });
  it.each(TRACKS)('AI completes a real lap on $name without recovery', (track) => {
    const r = createRacer(track, 1);
    let time = 0;
    for (let i = 0; i < 120 * 220 && !r.finished; i++) {
      const previous = { x: r.x, z: r.z };
      time = i / 120;
      stepRacer(r, aiInput(r, track, [r]), track, time, 1 / 120);
      updateProgress(r, previous, track, time, 1);
    }
    console.log(track.name, {
      finished: r.finished,
      lap: r.laps[0],
      gate: r.nextGate,
      x: r.x,
      z: r.z,
    });
    expect(r.finished).toBe(true);
    expect(r.laps[0]).toBeGreaterThan(45);
    expect(r.laps[0]).toBeLessThan(80);
  });
});

it('separates racers even when their centers coincide', () => {
  const a = createRacer(TRACKS[0], 0),
    b = createRacer(TRACKS[0], 1);
  Object.assign(b, { x: a.x, y: a.y, z: a.z });
  expect(collideRacers(a, b)).toBe(true);
  expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(2.7);
});

it('launches off a ramp and lands back on the moving water', () => {
  const track = TRACKS[0],
    ramp = track.ramps[0],
    r = createRacer(track, 0);
  Object.assign(r, {
    x: ramp.x - ramp.tx * 25,
    z: ramp.z - ramp.tz * 25,
    yaw: Math.atan2(ramp.tx, ramp.tz),
    vx: ramp.tx * 24,
    vz: ramp.tz * 24,
  });
  r.y = waterHeight(r.x, r.z, 0, track.wave) + 0.6;
  let launched = false,
    landed = false,
    maxHeight = 0;
  for (let i = 0; i < 120 * 6; i++) {
    stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
    maxHeight = Math.max(maxHeight, r.y);
    if (r.y > 3 && r.wet === 0) launched = true;
    if (launched && r.wet > 0 && r.y < 2) landed = true;
  }
  expect(launched).toBe(true);
  expect(landed).toBe(true);
  expect(maxHeight).toBeGreaterThan(4);
});
