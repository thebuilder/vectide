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

it("aims Storm's grid toward a well-spaced first checkpoint", () => {
  const track = TRACKS[2],
    start = track.gates[0],
    first = track.gates[1];
  const dx = first.x - start.x,
    dz = first.z - start.z,
    distance = Math.hypot(dx, dz);
  expect(distance).toBeGreaterThan(65);
  expect(distance).toBeLessThan(100);
  expect((dx * start.tx + dz * start.tz) / distance).toBeGreaterThan(0.95);
  expect((dx * first.tx + dz * first.tz) / distance).toBeGreaterThan(0.95);
  const firstRow = pickupRows(track).filter((box) => box.row === 0);
  expect(
    firstRow.every((box) => nearestPoint(track, box) > nearestPoint(track, track.gates[1])),
  ).toBe(true);
});

it('keeps Storm checkpoints facing their approaches with an open line between gates', async () => {
  const { gatePointClear } = await import('../src/game/course-layout');
  const track = TRACKS[2];
  for (const [index, gate] of track.gates.entries()) {
    const previous = track.gates[(index + track.gates.length - 1) % track.gates.length];
    const dx = gate.x - previous.x,
      dz = gate.z - previous.z;
    // Edge-on gates lose their visible opening. Keep at least 80% of it facing the approach.
    expect((dx * gate.tx + dz * gate.tz) / Math.hypot(dx, dz), `gate ${index + 1}`).toBeGreaterThan(
      0.8,
    );
    for (let step = 0; step <= 30; step++) {
      expect(
        gatePointClear(previous.x + (dx * step) / 30, previous.z + (dz * step) / 30, track.land),
        `shore blocks gate ${index + 1}`,
      ).toBe(true);
    }
  }
});
