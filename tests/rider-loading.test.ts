import { expect, it } from 'vitest';
import { stepRiderLoad } from '../src/game/rider-load';
import { createRacer, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { waterHeight, type WaveZone } from '../src/game/water';

const flat = { ...TRACKS[0], wave: 0, ramps: [], obstacles: [], waveZones: [] };
it('loads a normal carve while keeping both feet planted', () => {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 0.35, yaw: 0, vx: 0, vz: 18 });
  for (let f = 0; f < 180; f++)
    stepRacer(r, { throttle: 1, brake: 0, steer: 1, lean: 0 }, flat, f / 120, 1 / 120);
  expect(r.body.side).toBeGreaterThan(0.6);
  expect(r.body.foot).toBe(0);
  expect(r.roll).toBeLessThan(-0.2);
  for (let f = 0; f < 180; f++)
    stepRacer(r, { throttle: 0, brake: 1, steer: 0, lean: 0 }, flat, f / 120, 1 / 120);
  expect(Math.abs(r.body.foot)).toBeLessThan(0.01);
});
it('permits a hard water entry, loses speed, then floats back up', () => {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 5, yaw: 0, pitch: -0.25, vx: 0, vz: 18, vy: -4 });
  let submerged = 0,
    impact = 0,
    slowest = 18;
  for (let f = 0; f < 120 * 4; f++) {
    stepRacer(r, { throttle: 1, brake: 0, steer: 0, lean: 0 }, flat, f / 120, 1 / 120);
    submerged = Math.min(submerged, r.y);
    impact = Math.max(impact, r.body.impact);
    slowest = Math.min(slowest, Math.hypot(r.vx, r.vz));
  }
  expect(submerged).toBeLessThan(-0.35);
  expect(submerged).toBeGreaterThan(-2.5);
  expect(impact).toBeGreaterThan(6);
  // Aligned entries keep more momentum while still shedding speed.
  expect(slowest).toBeLessThan(17);
  expect(slowest).toBeGreaterThan(12);
  expect(r.y).toBeGreaterThan(0);
});
it('launches from a localized wave without touching a ramp', () => {
  const wave: WaveZone = {
    name: 'swell run',
    x: 0,
    z: 0,
    tx: 0,
    tz: -1,
    length: 500,
    width: 160,
    shelter: 0.8,
    swell: 2.5,
    wavelength: 30,
    speed: 5,
  };
  const track = { ...flat, wave: 1, waveZones: [wave] };
  const r = createRacer(track, 0);
  Object.assign(r, {
    x: 0,
    z: -100,
    y: waterHeight(0, -100, 0, track) + 0.4,
    yaw: 0,
    vx: 0,
    vz: 20,
  });
  let longest = 0,
    height = 0;
  for (let f = 0; f < 120 * 6; f++) {
    stepRacer(r, { throttle: 1, brake: 0, steer: 0, lean: 0 }, track, f / 120, 1 / 120);
    longest = Math.max(longest, r.body.airtime);
    height = Math.max(height, r.y - waterHeight(r.x, r.z, f / 120, track));
    expect(r.onRamp).toBe(false);
  }
  expect(longest).toBeGreaterThan(0.5);
  expect(height).toBeGreaterThan(1.5);
});

it.each([-1, 1])('extends the inside foot only beyond 45 degrees, direction %s', (side) => {
  const r = createRacer(flat, 0);
  r.vz = 18;
  r.wet = 1;
  r.body.side = side * 0.72;
  const input = { throttle: 1, brake: 0, steer: side, lean: 0 };
  for (const degrees of [30, 44, 45]) {
    r.roll = (-side * degrees * Math.PI) / 180;
    for (let i = 0; i < 120; i++) stepRiderLoad(r, input, 1 / 120);
    expect(r.body.foot).toBe(0);
  }
  r.roll = (-side * Math.PI) / 3;
  for (let i = 0; i < 120; i++) stepRiderLoad(r, input, 1 / 120);
  expect(r.body.foot * side).toBeGreaterThan(0.95);
  r.wet = 0;
  for (let i = 0; i < 120; i++) stepRiderLoad(r, input, 1 / 120);
  expect(Math.abs(r.body.foot)).toBeLessThan(0.001);
});
