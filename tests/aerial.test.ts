import { expect, it } from 'vitest';
import { createRacer, stepRacer, updateProgress, recoverRacer } from '../src/game/physics';
import { landAerial, stepAerial, cancelTrickSetup } from '../src/game/aerial';
import { beginRecovery } from '../src/game/recovery';
import { TRACKS } from '../src/game/tracks';
const track = { ...TRACKS[0], wave: 0, waveZones: [], land: [], obstacles: [], ramps: [] };
function jump(height: number, velocity: number, trick: number) {
  const r = createRacer(track, 0);
  for (let i = 0; i < 24; i++)
    stepAerial(r, { throttle: 1, steer: 0, brake: 0, lean: 0, trick }, 0.5, 1 / 120);
  r.wet = 0;
  Object.assign(r, { x: 0, z: 0, y: height, vy: velocity, vx: 0, vz: 20, yaw: 0 });
  r.body.airtime = 0.2;
  const phases = new Set<string>();
  let rotated = false,
    landed = false;
  for (let f = 0; f < 120 * 9; f++) {
    stepRacer(r, { throttle: 1, brake: 0, steer: 0, lean: 0, trick: 0 }, track, f / 120, 1 / 120);
    phases.add(r.recovery.phase);
    rotated ||= Math.abs(r.air.pitch) + Math.abs(r.air.yaw) > 2;
    landed ||= r.air.message.endsWith('LANDED');
  }
  return { r, phases, rotated, landed };
}
it.each([1, 2, -2])('completes an airborne trick %s when there is enough height', (trick) => {
  const { r, phases, rotated, landed } = jump(8, 5, trick);
  expect(rotated).toBe(true);
  expect(landed).toBe(true);
  expect([...phases]).toEqual(['riding']);
  expect(r.recovery.crashes).toBe(0);
  expect(r.air.pitch).toBe(0);
  expect(r.air.yaw).toBe(0);
});
it('a late trick throws the rider off and remounts beside the craft', () => {
  const { r, phases, landed } = jump(1.8, -4, 1);
  expect(landed).toBe(false);
  expect(phases.has('falling')).toBe(true);
  expect(phases.has('swimming')).toBe(true);
  expect(phases.has('remounting')).toBe(true);
  expect(r.recovery.phase).toBe('riding');
  expect(r.recovery.crashes).toBe(1);
  expect(r.passed).toBe(0);
  expect(r.laps).toEqual([]);
  expect(r.recovered).toBe(false);
});
it('does not advance a gate while the rider is separated, and Reset clears the sequence', () => {
  const r = createRacer(track, 0),
    g = track.gates[0];
  beginRecovery(r);
  const previous = { x: g.x - g.tx, z: g.z - g.tz };
  Object.assign(r, { x: g.x + g.tx, z: g.z + g.tz });
  expect(updateProgress(r, previous, track, 10, 3)).toBe(false);
  expect(r.passed).toBe(0);
  recoverRacer(r, track, 10);
  expect(r.recovery.phase).toBe('riding');
  expect(r.air.trick).toBe('none');
  expect(r.recovered).toBe(true);
});
it('ignores trick input on the water', () => {
  const r = createRacer(track, 0);
  for (let f = 0; f < 120; f++)
    stepRacer(r, { throttle: 1, brake: 0, steer: 0, lean: 0, trick: 1 }, track, f / 120, 1 / 120);
  expect(r.air.trick).toBe('none');
  expect(r.recovery.crashes).toBe(0);
});

it('rewards a completed flip once with a small boost along existing momentum', () => {
  const r = createRacer(track, 0);
  Object.assign(r, { vx: 12, vz: 16 });
  r.air.pending = 'FLIP LANDED';
  landAerial(r, -5);
  expect(Math.hypot(r.vx, r.vz)).toBeCloseTo(22);
  expect(r.vx / r.vz).toBeCloseTo(12 / 16);
  landAerial(r, -5);
  expect(Math.hypot(r.vx, r.vz)).toBeCloseTo(22);
});
it.each(['ordinary', 'spin', 'failed', 'finished'])('does not reward a %s landing', (kind) => {
  const r = createRacer(track, 0);
  r.vz = 20;
  if (kind === 'spin') r.air.pending = 'SPIN LANDED';
  if (kind === 'failed') {
    r.air.trick = 'flip';
    r.air.progress = 0.5;
  }
  if (kind === 'finished') {
    r.air.pending = 'FLIP LANDED';
    r.finished = true;
  }
  landAerial(r, -5);
  expect(Math.hypot(r.vx, r.vz)).toBeLessThanOrEqual(20);
});

const input = (trick: number) => ({ throttle: 1, steer: 0, brake: 0, lean: 0, trick });
function loaded() {
  const r = createRacer(track, 0);
  r.wet = 1;
  for (let i = 0; i < 30; i++) stepAerial(r, input(1), 0.5, 1 / 120);
  return r;
}
it('buffers a release just before takeoff without rotating on the ramp', () => {
  const r = loaded();
  r.onRamp = true;
  stepAerial(r, input(0), 0.5, 0.1);
  expect(r.air.trick).toBe('none');
  r.onRamp = false;
  r.wet = 0;
  r.body.airtime = 0.04;
  stepAerial(r, input(0), 1, 0.04);
  expect(r.air.trick).toBe('flip');
});
it('cancels a release well before takeoff', () => {
  const r = loaded();
  stepAerial(r, input(0), 0.5, 0.01);
  for (let i = 0; i < 40; i++) stepAerial(r, input(0), 0.5, 0.01);
  r.wet = 0;
  r.body.airtime = 0.1;
  stepAerial(r, input(0), 2, 0.01);
  expect(r.air.trick).toBe('none');
});
it('does not load a trick by pressing in midair', () => {
  const r = createRacer(track, 0);
  r.wet = 0;
  r.body.airtime = 0.1;
  for (let i = 0; i < 20; i++) stepAerial(r, input(1), 3, 0.01);
  stepAerial(r, input(0), 3, 0.01);
  expect(r.air.trick).toBe('none');
});
it('cancellation clears held and buffered intent without starting a trick', () => {
  const r = loaded();
  cancelTrickSetup(r);
  r.wet = 0;
  r.body.airtime = 0.1;
  stepAerial(r, input(0), 2, 0.01);
  expect(r.air.trick).toBe('none');
  expect(r.air.charge).toBe(0);
});

it.each([0, 2])('loads on a real ramp and releases %s meters before the lip', (lead) => {
  const course = TRACKS[0],
    ramp = course.ramps[0],
    r = createRacer(course, 0);
  Object.assign(r, {
    x: ramp.x - ramp.tx * 25,
    z: ramp.z - ramp.tz * 25,
    yaw: Math.atan2(ramp.tx, ramp.tz),
    vx: ramp.tx * 22,
    vz: ramp.tz * 22,
  });
  let released = false,
    wasOnRamp = false,
    started = false,
    landed = false,
    maxCompression = 0;
  for (let frame = 0; frame < 120 * 8; frame++) {
    const along = (r.x - ramp.x) * ramp.tx + (r.z - ramp.z) * ramp.tz;
    wasOnRamp ||= r.onRamp;
    if (wasOnRamp && along >= ramp.length / 2 - lead) released = true;
    stepRacer(r, input(released ? 0 : 1), course, frame / 120, 1 / 120);
    started ||= r.air.trick === 'flip';
    landed ||= r.air.message === 'FLIP LANDED';
    maxCompression = Math.max(maxCompression, r.body.compression);
  }
  expect(started).toBe(true);
  expect(landed).toBe(true);
  expect(maxCompression).toBeGreaterThan(0.25);
  expect(r.recovery.crashes).toBe(0);
});
