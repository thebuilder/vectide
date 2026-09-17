import { expect, it } from 'vitest';
import { createRacer, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { waterHeight } from '../src/game/water';

const flat = {
  ...TRACKS[0],
  wave: 0,
  waveZones: [],
  shore: undefined,
  land: [],
  ramps: [],
  obstacles: [],
};
const drive = { throttle: 1, brake: 0, steer: 0, lean: 0 };

function flight(lean: number, dt = 1 / 120) {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 4, vx: 0, vz: 20, vy: 3, yaw: 0, wet: 0 });
  let elapsed = 0,
    peak = r.y;
  while (elapsed < 4) {
    stepRacer(r, { ...drive, lean }, flat, elapsed, dt);
    elapsed += dt;
    peak = Math.max(peak, r.y);
    if (r.wet > 0) break;
  }
  return { r, elapsed, peak };
}

it('shortens a forward jump and extends a backward jump at a speed cost', () => {
  const forward = flight(-1),
    neutral = flight(0),
    back = flight(1);
  console.log(
    'flight',
    [forward, neutral, back].map(({ r, elapsed, peak }) => ({
      elapsed,
      peak,
      speed: Math.hypot(r.vx, r.vz),
      pitch: r.pitch,
    })),
  );
  expect(forward.elapsed).toBeLessThan(neutral.elapsed - 0.08);
  expect(back.elapsed).toBeGreaterThan(neutral.elapsed + 0.05);
  expect(back.elapsed).toBeLessThan(neutral.elapsed + 0.4);
  expect(back.peak).toBeGreaterThan(neutral.peak + 0.1);
  expect(Math.hypot(back.r.vx, back.r.vz)).toBeLessThan(Math.hypot(neutral.r.vx, neutral.r.vz));
  for (const run of [forward, neutral, back]) {
    expect(run.r.air.armed).toBe(false);
    expect(run.r.recovery.crashes).toBe(0);
  }
});

it('expires airborne assistance and settles the pitch after release', () => {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 100, vz: 20, yaw: 0, wet: 0 });
  for (let i = 0; i < 180; i++) stepRacer(r, { ...drive, lean: 1 }, flat, i / 120, 1 / 120);
  expect(r.pitch).toBeGreaterThan(0.3);
  expect(r.pitch).toBeLessThan(0.8);
  const velocity = r.vy;
  for (let i = 0; i < 120; i++) stepRacer(r, { ...drive, lean: 1 }, flat, (180 + i) / 120, 1 / 120);
  expect(r.vy - velocity).toBeCloseTo(-9.81, 5);
  for (let i = 0; i < 240; i++) stepRacer(r, drive, flat, (300 + i) / 120, 1 / 120);
  expect(Math.abs(r.pitch)).toBeLessThan(0.1);
});

it('gives forward lean a tighter water carve and back lean a looser one', () => {
  const runs = [-1, 0, 1].map((lean) => {
    const r = createRacer(flat, 0);
    Object.assign(r, { x: 0, z: 0, y: 0.4, vz: 20, yaw: 0 });
    for (let i = 0; i < 180; i++)
      stepRacer(r, { ...drive, steer: 0.7, lean }, flat, i / 120, 1 / 120);
    return r;
  });
  console.log(
    'carves',
    runs.map((r) => ({ yaw: r.yaw, pitch: r.pitch, wet: r.wet })),
  );
  expect(runs[0].yaw).toBeGreaterThan(runs[1].yaw + 0.1);
  expect(runs[2].yaw).toBeLessThan(runs[1].yaw - 0.1);
  expect(runs[0].pitch).toBeLessThan(runs[2].pitch - 0.1);
  for (const r of runs) expect(r.recovery.crashes).toBe(0);
});

it('produces distinct low and high lines over the same swell', () => {
  const track = {
    ...flat,
    wave: 1,
    waveZones: [
      {
        name: 'swell',
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
      },
    ],
  };
  const runs = [-1, 0, 1].map((lean) => {
    const r = createRacer(track, 0);
    Object.assign(r, { x: 0, z: -100, y: waterHeight(0, -100, 0, track) + 0.4, yaw: 0, vz: 20 });
    let peak = 0,
      airborne = 0;
    for (let i = 0; i < 120; i++) {
      stepRacer(r, { ...drive, lean }, track, i / 120, 1 / 120);
      peak = Math.max(peak, r.y - waterHeight(r.x, r.z, i / 120, track));
      if (r.wet === 0) airborne++;
    }
    return { peak, airborne, crashes: r.recovery.crashes };
  });
  console.log('waves', runs);
  expect(runs[0].peak).toBeLessThan(runs[1].peak - 0.2);
  expect(runs[2].peak).toBeGreaterThan(runs[1].peak + 0.2);
  expect(runs[0].airborne).toBeLessThan(runs[2].airborne);
  for (const run of runs) expect(run.crashes).toBe(0);
});

it('keeps flight outcomes consistent across simulation step sizes', () => {
  for (const lean of [-1, 0, 1]) {
    const slow = flight(lean, 1 / 60),
      fast = flight(lean, 1 / 120);
    expect(Math.abs(slow.elapsed - fast.elapsed)).toBeLessThan(0.04);
    expect(Math.abs(slow.peak - fast.peak)).toBeLessThan(0.04);
  }
});

it('leaves stunt flight ballistic while allowing full rotation', () => {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 100, vz: 20, yaw: 0, wet: 0 });
  r.air.armed = true;
  for (let i = 0; i < 120; i++) stepRacer(r, { ...drive, lean: 1 }, flat, i / 120, 1 / 120);
  expect(r.vy).toBeCloseTo(-9.81, 5);
  expect(r.vz).toBe(20);
  expect(r.air.pitch).toBeGreaterThan(Math.PI);
});

it.each([-1, 1])('cannot launch from stationary flat water by leaning %s', (lean) => {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 0.4, yaw: 0 });
  for (let i = 0; i < 600; i++)
    stepRacer(r, { ...drive, throttle: 0, lean }, flat, i / 120, 1 / 120);
  expect(r.body.airtime).toBe(0);
  expect(r.y).toBeLessThan(0.6);
  expect(r.recovery.crashes).toBe(0);
});
