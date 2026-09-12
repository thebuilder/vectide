import { expect, it } from 'vitest';
import { TRACKS, nearestPoint } from '../src/game/tracks';
import { pickupRows } from '../src/game/pickups';

it('keeps ramp combos on Palm and sends Storm around in the opposite direction', () => {
  expect(TRACKS[0].ramps).toHaveLength(3);
  expect(TRACKS[1].ramps).toHaveLength(0);
  expect(TRACKS[2].ramps).toHaveLength(0);
  const direction = (points: (typeof TRACKS)[number]['points']) =>
    Math.sign(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.z - q.x * p.z;
      }, 0),
    );
  expect(direction(TRACKS[2].points)).toBe(-direction(TRACKS[0].points));
  expect(direction(TRACKS[2].points)).toBe(-direction(TRACKS[1].points));
});

it.each(TRACKS.slice(1))('gives each pickup row space and time on $name', (track) => {
  const boxes = pickupRows(track);
  const centers = boxes.filter((_, i) => i % 3 === 1);
  expect(centers).toHaveLength(5);
  for (const [i, center] of centers.entries()) {
    const next = centers[(i + 1) % centers.length],
      index = nearestPoint(track, center),
      nextIndex = nearestPoint(track, next),
      gap =
        (((nextIndex - index + track.points.length) % track.points.length) * track.length) /
        track.points.length;
    // At a fast 25 m/s this leaves at least seven seconds between rows, including the lap wrap.
    expect(gap).toBeGreaterThan(175);
    for (const box of boxes.filter((box) => box.row === center.row)) {
      expect(
        Math.min(...track.gates.map((g) => Math.hypot(box.x - g.x, box.z - g.z))),
      ).toBeGreaterThan(20);
    }
    const row = boxes.filter((box) => box.row === center.row);
    expect(Math.hypot(row[0].x - row[1].x, row[0].z - row[1].z)).toBeGreaterThan(4);
  }
});

it.each(TRACKS)('faces checkpoints toward the local riding line on $name', (track) => {
  for (const gate of track.gates) {
    const approach =
      track.points[(gate.routeIndex! - 18 + track.points.length) % track.points.length];
    const dx = gate.x - approach.x,
      dz = gate.z - approach.z;
    expect((dx * gate.tx + dz * gate.tz) / Math.hypot(dx, dz), gate.name).toBeGreaterThan(0.8);
  }
});

it("aims Storm's grid toward a well-spaced first checkpoint", () => {
  const track = TRACKS[2],
    start = track.gates[0],
    first = track.gates[1];
  const dx = first.x - start.x,
    dz = first.z - start.z,
    distance = Math.hypot(dx, dz);
  expect(distance).toBeGreaterThan(65);
  expect(distance).toBeLessThan(140);
  expect((dx * start.tx + dz * start.tz) / distance).toBeGreaterThan(0.95);
  expect((dx * first.tx + dz * first.tz) / distance).toBeGreaterThan(0.6);
  const firstRow = pickupRows(track).filter((box) => box.row === 0);
  expect(
    firstRow.every((box) => nearestPoint(track, box) > nearestPoint(track, track.gates[1])),
  ).toBe(true);
});

it.each(TRACKS)('leaves a clear water route between its distant gates on $name', async (track) => {
  const { gatePointClear } = await import('../src/game/course-layout');
  for (let i = 0; i < track.points.length; i += 6) {
    const p = track.points[i];
    expect(gatePointClear(p.x, p.z, track.land), `route point ${i}`).toBe(true);
  }
});
