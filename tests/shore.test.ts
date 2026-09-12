import { expect, it } from 'vitest';
import { createShoreField, shoreDistance, coastalHeight } from '../src/game/shore';
import { TRACKS } from '../src/game/tracks';
import { vertexHeight, waterHeight } from '../src/game/water';
import { Pickups } from '../src/game/pickups';
import { PRACTICE } from '../src/multiplayer/practice';

it('samples a signed shoreline field and leaves the offshore sea unchanged', () => {
  const field = createShoreField([
    {
      name: 'test',
      kind: 'island',
      x: 0,
      z: 0,
      height: 3,
      outline: [
        { x: -20, z: -20 },
        { x: 20, z: -20 },
        { x: 20, z: 20 },
        { x: -20, z: 20 },
      ],
    },
  ])!;
  expect(shoreDistance(0, 0, field)).toBe(-20);
  expect(shoreDistance(20, 0, field)).toBe(0);
  expect(shoreDistance(25, 0, field)).toBe(5);
  expect(shoreDistance(400, 0, field)).toBe(32);
  for (let t = 0; t < 10; t += 0.13) {
    expect(coastalHeight(8, 0, t)).toBeLessThanOrEqual(0);
    expect(coastalHeight(8, 2, t)).toBeLessThan(0.33);
    expect(coastalHeight(8, 32, t)).toBe(8);
  }
});

it.each(TRACKS)('keeps water beneath the dry bank through changing swell on $name', (track) => {
  for (const land of track.land)
    for (let i = 0; i < land.outline.length; i++) {
      const a = land.outline[i],
        b = land.outline[(i + 1) % land.outline.length];
      for (const fraction of [0, 0.25, 0.5, 0.75]) {
        const x = a.x + (b.x - a.x) * fraction,
          z = a.z + (b.z - a.z) * fraction;
        for (let time = 0; time < 12; time += 0.31)
          expect(waterHeight(x, z, time, track)).toBeLessThan(0.45);
      }
    }
});

it('carries the coast into item physics but removes it from open-water practice', () => {
  expect(new Pickups(TRACKS[0], true).surface.shore).toBe(TRACKS[0].shore);
  expect(PRACTICE.shore).toBeUndefined();
  const shore = TRACKS[0].land[0];
  const surface = { ...TRACKS[0], pulses: [{ kind: 4, x: shore.x, z: shore.z, yaw: 0, age: 0.1 }] };
  expect(vertexHeight(shore.x, shore.z, 0, surface)).toBeLessThanOrEqual(0);
});
