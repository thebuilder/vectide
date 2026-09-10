import { expect, it } from 'vitest';
import { createRacer, stepRacer, type Input } from '../src/game/physics';
import { TRACKS, type Track } from '../src/game/tracks';
import { waterHeight } from '../src/game/water';

const dt = 1 / 120;
const full: Input = { throttle: 1, steer: 0, brake: 0, lean: 0 };
const flat: Track = { ...TRACKS[0], wave: 0, waveZones: [], land: [], obstacles: [], ramps: [] };
const cruise = Math.sqrt(19 / 0.037);
const speed = (r: ReturnType<typeof createRacer>) => Math.hypot(r.vx, r.vz);
function rider(velocity = 0) {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 0.6, yaw: 0, vx: 0, vz: velocity });
  return r;
}
it('launches quickly but builds the upper speed range over several seconds', () => {
  const r = rider();
  let half = 0,
    almost = 0;
  for (let i = 0; i < 120 * 10; i++) {
    stepRacer(r, full, flat, i * dt, dt);
    if (!half && speed(r) >= cruise * 0.5) half = i * dt;
    if (!almost && speed(r) >= cruise * 0.95) almost = i * dt;
  }
  expect(half).toBeLessThan(1);
  expect(almost).toBeGreaterThan(3.5);
  expect(almost).toBeLessThan(5);
  expect(speed(r)).toBeCloseTo(cruise, 1);
});
it('brief lift-off carries momentum while deliberate braking remains effective', () => {
  const coast = rider(cruise),
    brake = rider(cruise);
  for (let i = 0; i < 24; i++) {
    stepRacer(coast, { ...full, throttle: 0 }, flat, i * dt, dt);
    stepRacer(brake, { ...full, throttle: 0, brake: 1 }, flat, i * dt, dt);
  }
  expect(speed(coast) / cruise).toBeGreaterThan(0.94);
  expect(speed(brake) / cruise).toBeLessThan(0.75);
});
it('airborne throttle and steering cannot manufacture momentum', () => {
  for (const throttle of [0, 0.5, 1]) {
    const r = rider(20);
    r.y = 50;
    for (let i = 0; i < 120; i++)
      stepRacer(r, { ...full, throttle, brake: 1, steer: 1 }, flat, i * dt, dt);
    expect(r.z).toBeCloseTo(20, 8);
    expect(speed(r)).toBeCloseTo(20, 8);
    expect(r.yaw).toBe(0);
  }
});
const swell: Track = {
  ...flat,
  wave: 1,
  waveZones: [
    {
      name: 'Swell',
      x: 0,
      z: 0,
      tx: 0,
      tz: 1,
      length: 10000,
      width: 10000,
      shelter: 1,
      swell: 2,
      wavelength: 40,
      speed: 5,
    },
  ],
};
it('retains more speed when the hull matches the descending landing face', () => {
  const z = 16;
  const slope = (waterHeight(0, z + 1.5, 0, swell) - waterHeight(0, z - 1.5, 0, swell)) / 3;
  const land = (pitch: number) => {
    const r = rider(20);
    Object.assign(r, { z, y: waterHeight(0, z, 0, swell) + 0.1, vy: -6, pitch });
    r.body.airtime = 0.5;
    stepRacer(r, full, swell, 0, dt);
    expect(r.wet).toBeGreaterThan(0);
    return speed(r);
  };
  expect(land(Math.atan(slope))).toBeGreaterThan(land(0.7));
});
it('rewards following swell and bounds speed over repeated waves', () => {
  const averages: number[] = [];
  for (const direction of [1, -1]) {
    const track = { ...swell, waveZones: [{ ...swell.waveZones![0], tz: direction }] };
    let total = 0,
      count = 0;
    for (let phase = 0; phase < 4; phase++) {
      const r = rider(cruise);
      r.y = waterHeight(0, 0, phase * 2, track) + 0.6;
      for (let i = 0; i < 120 * 30; i++) {
        stepRacer(r, full, track, phase * 2 + i * dt, dt);
        expect(speed(r)).toBeLessThan(28);
        if (i > 120 * 3) {
          total += speed(r);
          count++;
        }
      }
      expect(r.recovery.crashes).toBe(0);
    }
    averages.push(total / count);
  }
  expect(averages[0]).toBeGreaterThan(averages[1] + 0.5);
});
