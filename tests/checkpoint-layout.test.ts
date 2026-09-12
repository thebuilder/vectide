import { expect, it } from 'vitest';
import { checkpointDistance, TRACKS } from '../src/game/tracks';
import {
  aiInput,
  createRacer,
  racePosition,
  raceProgress,
  recoverRacer,
  updateProgress,
} from '../src/game/physics';
import { hullPoints, polygonContact } from '../src/game/hull-contact';

it.each(TRACKS)('uses separated, named route-choice checkpoints on $name', (track) => {
  expect(track.gates.length).toBeLessThanOrEqual(6);
  expect(new Set(track.gates.map((g) => g.name)).size).toBe(track.gates.length);
  for (const [i, gate] of track.gates.entries()) {
    expect(checkpointDistance(track, i), gate.name).toBeGreaterThan(100);
    if (i) expect(gate.routeIndex!).toBeGreaterThan(track.gates[i - 1].routeIndex!);
  }
});

it.each(TRACKS)('still requires every checkpoint in order to complete a lap on $name', (track) => {
  for (let skipped = 1; skipped < track.gates.length; skipped++) {
    const r = createRacer(track, 0);
    for (const i of [...track.gates.map((_, i) => i), 0]) {
      if (i === skipped) continue;
      const gate = track.gates[i];
      const before = { x: gate.x - gate.tx, z: gate.z - gate.tz };
      r.x = gate.x + gate.tx;
      r.z = gate.z + gate.tz;
      updateProgress(r, before, track, i + 1, 1);
    }
    expect(r.nextGate).toBe(skipped);
    expect(r.laps).toHaveLength(0);
    expect(r.finished).toBe(false);
  }
});

it.each([
  { track: TRACKS[0], from: [35, -130], to: [135, -25], shore: 'Crescent island' },
  { track: TRACKS[0], from: [278, 110], to: [95, 170], shore: 'Outer island' },
  { track: TRACKS[2], from: [-12, 126], to: [80, 131], shore: 'Cross-swell reef' },
  { track: TRACKS[2], from: [80, 131], to: [210, 63], shore: 'East breakwater' },
  { track: TRACKS[2], from: [210, 63], to: [68, -142], shore: 'Signal island' },
])('uses $shore to block a direct cut across its bend', ({ track, from, to, shore }) => {
  const r = createRacer(track, 0),
    land = track.land.find((l) => l.name === shore)!;
  r.yaw = Math.atan2(to[0] - from[0], to[1] - from[1]);
  let blocked = false;
  for (let i = 0; i <= 100; i++) {
    r.x = from[0] + ((to[0] - from[0]) * i) / 100;
    r.z = from[1] + ((to[1] - from[1]) * i) / 100;
    blocked ||= !!polygonContact(hullPoints(r), land.outline);
  }
  expect(blocked).toBe(true);
});

it('continues ranking riders while both are over 120 metres from their next checkpoint', () => {
  const track = TRACKS[0],
    racers = [createRacer(track, 0), createRacer(track, 1)];
  for (const [i, r] of racers.entries()) {
    Object.assign(r, track.points[10 + i * 30], { passed: 1, nextGate: 1 });
    expect(Math.hypot(r.x - track.gates[1].x, r.z - track.gates[1].z)).toBeGreaterThan(120);
  }
  expect(racePosition(racers[1], racers, track)).toBe(1);
  expect(racePosition(racers[0], racers, track)).toBe(2);
});

it.each(TRACKS)(
  'resets along the water route rather than aiming through the next headland on $name',
  (track) => {
    const r = createRacer(track, 0);
    for (let next = 0; next < track.gates.length; next++) {
      r.passed = track.gates.length + next;
      r.nextGate = next;
      recoverRacer(r, track, 10);
      const previous = track.gates[(next - 1 + track.gates.length) % track.gates.length];
      expect(Math.sin(r.yaw) * previous.tx + Math.cos(r.yaw) * previous.tz).toBeCloseTo(1);
    }
  },
);

it('follows the Harbor route when a distant gate plane extends across the start', () => {
  const track = TRACKS[1],
    r = createRacer(track, 0);
  Object.assign(r, track.gates[0], { nextGate: 1, passed: 1 });
  const gate = track.gates[1];
  expect((r.x - gate.x) * gate.tx + (r.z - gate.z) * gate.tz).toBeGreaterThan(5);
  aiInput(r, track, [r]);
  expect(r.approachingGate).toBe(false);
});

it.each(TRACKS)(
  'does not drop a rider back a sector just beyond an angled gate on $name',
  (track) => {
    const r = createRacer(track, 0),
      gate = track.gates[1];
    r.passed = 1;
    r.nextGate = 1;
    Object.assign(r, track.points[gate.routeIndex! - 1]);
    const before = raceProgress(r, track);
    Object.assign(r, track.points[gate.routeIndex! + 1]);
    expect(raceProgress(r, track)).toBeGreaterThanOrEqual(before);
    expect(raceProgress(r, track)).toBeLessThanOrEqual((r.passed * 16) / track.gates.length);
  },
);

it.each(TRACKS)('still turns back for a checkpoint that was actually missed on $name', (track) => {
  const r = createRacer(track, 0),
    gate = track.gates[1];
  Object.assign(r, {
    x: gate.x + gate.tx * 12,
    z: gate.z + gate.tz * 12,
    nextGate: 1,
    passed: 1,
  });
  aiInput(r, track, [r]);
  expect(r.approachingGate).toBe(true);
});
