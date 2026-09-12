import { expect, it } from 'vitest';
import { createRacer, stepRacer } from '../src/game/physics';
import { stepAerial, landAerial } from '../src/game/aerial';
import { TRACKS } from '../src/game/tracks';

const neutral = { throttle: 1, brake: 0, steer: 0, lean: 0, trick: 0 };
function prepared() {
  const r = createRacer(TRACKS[0], 0);
  r.pitch = r.yaw = 0;
  r.wet = 1;
  for (let i = 0; i < 30; i++) stepAerial(r, { ...neutral, trick: 1 }, 0.5, 1 / 120);
  r.wet = 0;
  r.body.airtime = 0.1;
  stepAerial(r, neutral, 4, 1 / 120);
  expect(r.air.armed).toBe(true);
  return r;
}
function hold(r: ReturnType<typeof prepared>, lean: number, steer: number, seconds: number) {
  for (let i = 0; i < seconds * 120; i++) stepAerial(r, { ...neutral, lean, steer }, 4, 1 / 120);
}
it('prepare and release alone leaves rotation under player control', () => {
  const r = prepared();
  hold(r, 0, 0, 2);
  expect(r.air.pitch).toBe(0);
  expect(r.air.yaw).toBe(0);
  expect(r.air.armed).toBe(true);
});
it.each(['pitch', 'yaw'] as const)(
  'holding controls %s continuously through multiple rotations',
  (axis) => {
    const r = prepared();
    hold(r, Number(axis === 'pitch'), Number(axis === 'yaw'), 0.5);
    const first = r.air[axis];
    hold(r, Number(axis === 'pitch'), Number(axis === 'yaw'), 2);
    expect(first).toBeGreaterThan(2);
    expect(r.air[axis]).toBeGreaterThan(4 * Math.PI);
    expect(r.air.armed).toBe(true);
  },
);
it.each([60, 120, 144, 240])('countersteering brakes momentum before reversing at %i Hz', (hz) => {
  for (const axis of ['pitch', 'yaw'] as const) {
    for (const direction of [-1, 1]) {
      const r = prepared();
      hold(r, axis === 'pitch' ? direction : 0, axis === 'yaw' ? direction : 0, 0.5);
      const start = r.air[axis];
      const velocity = axis === 'pitch' ? 'pitchVelocity' : 'yawVelocity';
      const input = {
        ...neutral,
        lean: axis === 'pitch' ? -direction : 0,
        steer: axis === 'yaw' ? -direction : 0,
      };
      let stoppedAt = 0;
      for (let frame = 1; frame <= hz; frame++) {
        stepAerial(r, input, 4, 1 / hz);
        if (frame / hz <= 0.2) {
          expect(r.air[velocity] * direction).toBeGreaterThan(0);
          expect((r.air[axis] - start) * direction).toBeGreaterThan(0);
        }
        if (!stoppedAt && r.air[velocity] * direction <= 0) stoppedAt = frame / hz;
      }
      expect(stoppedAt).toBeGreaterThan(0.28);
      expect(stoppedAt).toBeLessThan(0.35);
      expect(r.air[velocity] * direction).toBeLessThan(-6);
    }
  }
});
it('combined flip and spin share the same braking budget', () => {
  const r = prepared();
  hold(r, 1, 1, 0.5);
  expect(Math.hypot(r.air.pitchVelocity, r.air.yawVelocity)).toBeCloseTo(6.8);
  hold(r, -1, -1, 0.25);
  expect(r.air.pitchVelocity).toBeGreaterThan(0);
  expect(r.air.yawVelocity).toBeGreaterThan(0);
  hold(r, -1, -1, 0.1);
  expect(r.air.pitchVelocity).toBeLessThan(0);
  expect(r.air.yawVelocity).toBeLessThan(0);
});
it('releasing retains forgiving damping for landing alignment', () => {
  const r = prepared();
  hold(r, 1, 0, 0.5);
  const before = r.air.pitch;
  hold(r, 0, 0, 0.45);
  expect(r.air.pitch).toBeGreaterThan(before);
  expect(Math.abs(r.air.pitchVelocity)).toBeLessThan(0.3);
});
it('centering helps near upright but never completes an inverted flip', () => {
  const aligned = prepared(),
    inverted = prepared();
  aligned.air.pitch = 2 * Math.PI - 0.3;
  inverted.air.pitch = Math.PI;
  hold(aligned, 0, 0, 1);
  hold(inverted, 0, 0, 1);
  expect(Math.abs(aligned.air.pitch - 2 * Math.PI)).toBeLessThan(0.01);
  expect(inverted.air.pitch).toBe(Math.PI);
});
it('counts multiple completed turns on landing and rewards a flip only once', () => {
  const r = prepared();
  r.air.pitch = 4 * Math.PI;
  r.vx = 12;
  r.vz = 16;
  r.yaw = Math.atan2(12, 16);
  landAerial(r, -5);
  expect(r.air.message).toBe('DOUBLE FLIP LANDED');
  expect(Math.hypot(r.vx, r.vz)).toBeCloseTo(22);
  expect(r.air.armed).toBe(false);
  landAerial(r, -5);
  expect(Math.hypot(r.vx, r.vz)).toBeCloseTo(22);
});
it('does not rotate or consume controls while dt is zero', () => {
  const r = prepared();
  hold(r, 1, 0, 0.3);
  const before = structuredClone(r);
  stepAerial(r, neutral, 4, 0);
  expect(r).toEqual(before);
});

it('clears a prepared jump on touchdown even before 120ms of airtime', () => {
  const track = {
    ...TRACKS[0],
    wave: 0,
    waveZones: [],
    shore: undefined,
    land: [],
    obstacles: [],
    ramps: [],
  };
  const r = createRacer(track, 0);
  Object.assign(r, { x: 0, z: 0, y: 0.55, vy: -2, wet: 0 });
  r.body.airtime = 0.05;
  r.air.armed = true;
  stepRacer(r, neutral, track, 0, 1 / 120);
  expect(r.wet).toBeGreaterThan(0);
  expect(r.air.armed).toBe(false);
});
