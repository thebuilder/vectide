import { expect, it } from 'vitest';
import { Wake } from '../src/game/wake';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { waterHeight } from '../src/game/water';

it('leaves a continuous, bounded trail that follows the current displaced water and fades', () => {
  const wake = new Wake(),
    track = TRACKS[2],
    r = createRacer(track, 0);
  r.vx = 22;
  for (let i = 0; i < 180; i++) {
    r.x += 22 / 60;
    wake.update([r], i / 60, track);
  }
  expect(wake.activeSegments).toBeGreaterThan(15);
  expect(wake.activeSegments).toBeLessThan(72);
  const positions = wake.object.geometry.attributes.position;
  for (let vertex = 0; vertex < wake.object.geometry.drawRange.count; vertex++) {
    const i = wake.object.geometry.index!.getX(vertex);
    expect(positions.getY(i)).toBeCloseTo(
      waterHeight(positions.getX(i), positions.getZ(i), 179 / 60, track) + 0.055,
      3,
    );
  }
  r.vx = 0;
  wake.update([r], 6, track);
  expect(wake.activeSegments).toBe(0);
});

it('never draws a connecting streak through a reset, airborne rider, or recovery', () => {
  const wake = new Wake(),
    track = TRACKS[0],
    r = createRacer(track, 0);
  r.vx = 22;
  const ride = (time: number) => {
    for (let i = 0; i < 10; i++) {
      r.x++;
      wake.update([r], time + i / 60, track);
    }
  };
  ride(0);
  expect(wake.activeSegments).toBeGreaterThan(0);
  r.x += 100;
  wake.update([r], 0.2, track);
  expect(wake.activeSegments).toBe(0);
  ride(0.3);
  r.wet = 0;
  wake.update([r], 0.5, track);
  expect(wake.activeSegments).toBe(0);
  r.wet = 1;
  ride(0.6);
  wake.clear();
  expect(wake.object.geometry.drawRange.count).toBe(0);
});

it('shares strip vertices within a fixed twelve-rider geometry budget', () => {
  const wake = new Wake(),
    track = TRACKS[0];
  const riders = Array.from({ length: 12 }, (_, id) => ({
    ...createRacer(track, 0),
    id,
    vx: 54,
    z: id * 6,
  }));
  for (let i = 0; i < 180; i++) {
    for (const r of riders) r.x += 0.9;
    wake.update(riders, i / 60, track);
  }
  const geometry = wake.object.geometry;
  expect(wake.activeSegments).toBe(12 * 71);
  expect(geometry.attributes.position.count).toBe(12 * 72 * 4);
  expect(geometry.drawRange.count).toBe(12 * 71 * 12);
  for (let i = 0; i < geometry.drawRange.count; i++)
    expect(geometry.index!.getX(i)).toBeLessThan(geometry.attributes.position.count);
});
