import { expect, it } from 'vitest';
import { gatePointClear } from '../src/game/course-layout';
import { pickupRows } from '../src/game/pickups';
import { aiInput, createRacer, crossesGate, stepRacer, updateProgress } from '../src/game/physics';
import { TRACKS, type Point } from '../src/game/tracks';
import { waveZoneWeight } from '../src/game/water';

const palm = TRACKS[0];
const port = TRACKS[1];

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

it('gives Palm a continuous approach that straightens before the large reef waves', () => {
  const from = palm.gates[1];
  const entrance = palm.gates[2];
  const exit = palm.gates[3];
  const reef = palm.waveZones!.find((zone) => zone.name === 'Reef wave channel')!;
  for (let i = from.routeIndex!; i < entrance.routeIndex!; i++) {
    const p = palm.points[i];
    const next = palm.points[i + 1];
    expect(next.x, `route point ${i}`).toBeGreaterThanOrEqual(p.x);
    expect(next.z, `route point ${i}`).toBeGreaterThanOrEqual(p.z);
  }
  expect(waveZoneWeight(entrance.x, entrance.z, reef)).toBeLessThan(0.1);
  expect(-(entrance.tx * reef.tx + entrance.tz * reef.tz)).toBeGreaterThan(0.9);
  const ahead = palm.points[entrance.routeIndex! + 40];
  expect(waveZoneWeight(ahead.x, ahead.z, reef)).toBeGreaterThan(0.7);
  expect(waveZoneWeight(exit.x, exit.z, reef)).toBeLessThan(0.4);
});

it.each([
  ['Container turn', 'Inner basin', 'Harbor mouth'],
  ['Cargo south passage', 'Southwest basin', 'West breakwater'],
])('requires the Port bend between %s and %s', (before, bend, after) => {
  const start = port.gates.find((gate) => gate.name === before)!;
  const required = port.gates.find((gate) => gate.name === bend)!;
  const end = port.gates.find((gate) => gate.name === after)!;
  expect(required).toBeDefined();
  expect(crossesGate(start, end, required)).toBe(false);
  expect(
    port.points.some((p, i) => crossesGate(p, port.points[(i + 1) % port.points.length], required)),
  ).toBe(true);
});

it.each([
  { track: palm, row: 1, from: 'Crescent turn', to: 'Reef entrance' },
  { track: palm, row: 2, from: 'Crescent turn', to: 'Reef entrance' },
  { track: palm, row: 4, from: 'Lagoon turn', to: 'Start / finish' },
  { track: port, row: 1, from: 'Container turn', to: 'Inner basin' },
  { track: port, row: 3, from: 'Cargo south passage', to: 'Southwest basin' },
  { track: port, row: 4, from: 'West breakwater', to: 'Start / finish' },
])(
  'puts a pickup on the clear $track.name approach from $from to $to',
  ({ track, row, from, to }) => {
    const start = track.gates.find((gate) => gate.name === from)!;
    const end = track.gates.find((gate) => gate.name === to)!;
    const samples = Math.ceil(Math.hypot(end.x - start.x, end.z - start.z));
    for (let i = 0; i <= samples; i++) {
      const x = start.x + ((end.x - start.x) * i) / samples;
      const z = start.z + ((end.z - start.z) * i) / samples;
      expect(gatePointClear(x, z, track.land)).toBe(true);
      expect(
        track.obstacles.every(
          (obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) > obstacle.radius + 3,
        ),
      ).toBe(true);
    }
    const boxes = pickupRows(track).filter((box) => box.row === row);
    expect(Math.min(...boxes.map((box) => distanceToSegment(box, start, end)))).toBeLessThan(2.5);
  },
);

it.each([palm, port])('keeps pickups within reach of both racing speeds on $name', (track) => {
  const boxes = pickupRows(track);
  for (const difficulty of ['normal', 'expert'] as const) {
    const r = createRacer(track, 1);
    const distances = Array<number>(5).fill(Infinity);
    let retries = 0;
    for (let frame = 0; frame < 120 * 90 && !r.finished; frame++) {
      const previous = { x: r.x, z: r.z };
      const approaching = r.approachingGate;
      const input = aiInput(r, track, [r], difficulty);
      if (!approaching && r.approachingGate) retries++;
      stepRacer(r, input, track, frame / 120, 1 / 120);
      updateProgress(r, previous, track, frame / 120, 1);
      for (const box of boxes) {
        distances[box.row] = Math.min(distances[box.row], Math.hypot(r.x - box.x, r.z - box.z));
      }
    }
    expect(r.finished, difficulty).toBe(true);
    expect(retries, difficulty).toBe(0);
    expect(r.recovery.crashes, difficulty).toBe(0);
    distances.forEach((distance, row) =>
      expect(distance, `${difficulty}, row ${row + 1}`).toBeLessThan(3),
    );
  }
});
