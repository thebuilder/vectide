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

it.each(TRACKS.slice(1))('aims the last checkpoint toward the finish on $name', (track) => {
  const last = track.gates.at(-1)!,
    finish = track.gates[0],
    dx = finish.x - last.x,
    dz = finish.z - last.z;
  expect((dx * last.tx + dz * last.tz) / Math.hypot(dx, dz)).toBeGreaterThan(0.9);
});

it("puts Storm's opening gate before the turn and its first pickups beyond it", () => {
  const track = TRACKS[2],
    start = track.gates[0],
    first = track.gates[1];
  const dx = first.x - start.x,
    dz = first.z - start.z,
    distance = Math.hypot(dx, dz);
  expect(distance).toBeGreaterThan(18);
  expect(distance).toBeLessThan(30);
  expect((dx * first.tx + dz * first.tz) / distance).toBeGreaterThan(0.95);
  const firstRow = pickupRows(track).filter((box) => box.row === 0);
  expect(
    firstRow.every((box) => nearestPoint(track, box) > nearestPoint(track, track.gates[2])),
  ).toBe(true);
});
