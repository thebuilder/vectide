import { expect, it } from 'vitest';
import { createRacer, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
const flat = {
  ...TRACKS[0],
  wave: 0,
  waveZones: [],
  shore: undefined,
  land: [],
  obstacles: [],
  ramps: [],
};
function entry(lean: number) {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 3, vx: 0, vz: 20, vy: -2, yaw: 0, pitch: 0, wet: 0 });
  r.body.airtime = 0.3;
  let minY = Infinity,
    minNose = Infinity,
    surfaceSpeed = 0,
    submerged = 0;
  for (let i = 0; i < 120 * 4; i++) {
    stepRacer(
      r,
      { throttle: 1, brake: 0, steer: 0, lean: i < 120 ? lean : 0 },
      flat,
      i / 120,
      1 / 120,
    );
    minY = Math.min(minY, r.y);
    minNose = Math.min(minNose, r.y + Math.sin(r.pitch) * 1.55);
    if (r.y < 0) {
      submerged++;
      surfaceSpeed = Math.hypot(r.vx, r.vz);
    }
  }
  return { r, minY, minNose, surfaceSpeed, submerged };
}
it('a forward entry briefly submerges the hull and buoyancy returns it to the surface', () => {
  const dive = entry(-1),
    normal = entry(0);
  expect(dive.minY).toBeLessThan(normal.minY - 0.03);
  expect(dive.surfaceSpeed).toBeLessThan(normal.surfaceSpeed - 0.3);
  expect(dive.minNose).toBeLessThan(normal.minNose - 0.2);
  expect(dive.submerged).toBeGreaterThan(5);
  expect(dive.submerged).toBeLessThan(120);
  expect(dive.r.y).toBeGreaterThan(0.1);
  expect(dive.r.recovery.phase).toBe('riding');
  expect(dive.r.recovery.crashes).toBe(0);
});
it('holding forward on flat water cannot sustain a dive', () => {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, vz: 20, yaw: 0 });
  for (let i = 0; i < 600; i++)
    stepRacer(r, { throttle: 1, brake: 0, steer: 0, lean: -1 }, flat, i / 120, 1 / 120);
  expect(r.y).toBeGreaterThan(0.1);
  expect(r.recovery.crashes).toBe(0);
});

it('forward input cannot turn an inverted impact into a safe dive', () => {
  const r = createRacer(flat, 0);
  Object.assign(r, { x: 0, z: 0, y: 0.8, vy: -10, vz: 20, wet: 0 });
  Object.assign(r.air, { armed: true, pitch: Math.PI });
  r.body.airtime = 0.3;
  for (let i = 0; i < 20 && r.recovery.phase === 'riding'; i++) {
    stepRacer(r, { throttle: 1, brake: 0, steer: 0, lean: -1 }, flat, i / 120, 1 / 120);
    expect(r.air.dive).toBe(0);
  }
  expect(r.recovery.phase).toBe('falling');
});
