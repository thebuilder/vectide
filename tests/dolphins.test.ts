import { it, expect } from 'vitest';
import { createDolphins } from '../src/game/dolphins';
import { TRACKS } from '../src/game/tracks';
import { polygonContact } from '../src/game/hull-contact';
import { waterHeight } from '../src/game/water';
import { createRacer } from '../src/game/physics';
it('breaches on approach, departs, and resets for another lap or race', () => {
  const track = TRACKS[0],
    pod = createDolphins(track),
    r = createRacer(track, 0);
  pod.update(0, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  Object.assign(r, track.dolphin);
  r.lap = 1;
  pod.update(10, r);
  pod.update(11, r);
  expect(pod.group.children.every((a) => a.visible)).toBe(true);
  pod.update(20, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  pod.update(21, r);
  expect(pod.group.children.every((a) => !a.visible)).toBe(true);
  r.lap = 2;
  pod.update(22, r);
  expect(pod.group.children[0].visible).toBe(true);
  pod.update(0, r);
  expect(pod.group.children[0].visible).toBe(true);
});

it.each(TRACKS)('keeps breaching dolphins clear of the racing line and shore on $name', (track) => {
  const pod = createDolphins(track),
    r = createRacer(track, 0);
  Object.assign(r, track.dolphin);
  pod.update(0, r);
  for (let frame = 0; frame < 4 * 60; frame++) {
    const t = frame / 60;
    pod.update(t, r);
    for (const animal of pod.group.children) {
      const { x, y, z } = animal.position;
      if (!animal.visible || y < waterHeight(x, z, t, track) - 1) continue;
      const clearance = Math.min(...track.points.map((p) => Math.hypot(x - p.x, z - p.z)));
      expect(clearance).toBeGreaterThan(12);
      const bounds = [
        { x: x - 2, z: z - 2 },
        { x: x + 2, z: z - 2 },
        { x: x + 2, z: z + 2 },
        { x: x - 2, z: z + 2 },
      ];
      for (const land of track.land)
        expect(polygonContact(bounds, land.outline), land.name).toBeNull();
    }
  }
});
