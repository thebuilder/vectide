import { it, expect } from 'vitest';
import { createDolphins } from '../src/game/dolphins';
import { TRACKS } from '../src/game/tracks';
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
