import { it, expect } from 'vitest';
import { VoxelSpray } from '../src/game/spray';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';

it('emits solid water fragments under power and clears them on restart', () => {
  const spray = new VoxelSpray(),
    racer = createRacer(TRACKS[0], 0);
  racer.vx = 25;
  spray.update(1 / 60, [racer], TRACKS[0], 0);
  expect(spray.activeCount).toBeGreaterThan(0);
  expect(spray.object.isInstancedMesh).toBe(true);
  spray.clear();
  expect(spray.activeCount).toBe(0);
});

it('creates a larger burst on landing and lets it settle and expire', () => {
  const spray = new VoxelSpray(),
    racer = createRacer(TRACKS[0], 0);
  racer.wet = 0;
  racer.vy = -8;
  spray.update(1 / 60, [racer], TRACKS[0], 0);
  expect(spray.activeCount).toBe(0);
  racer.wet = 1;
  spray.update(1 / 60, [racer], TRACKS[0], 1 / 60);
  expect(spray.activeCount).toBeGreaterThan(50);
  for (let i = 0; i < 180; i++) spray.update(1 / 60, [], TRACKS[0], i / 60);
  expect(spray.activeCount).toBe(0);
});

it('builds a substantially denser wake at speed instead of full spray when pulling away', () => {
  const slow = new VoxelSpray(),
    fast = new VoxelSpray(),
    track = TRACKS[0];
  const a = createRacer(track, 0),
    b = createRacer(track, 0);
  a.vx = 3;
  b.vx = 22;
  for (let i = 0; i < 30; i++) {
    slow.update(1 / 60, [a], track, i / 60);
    fast.update(1 / 60, [b], track, i / 60);
  }
  expect(slow.activeCount).toBeGreaterThan(0);
  expect(fast.activeCount).toBeGreaterThan(slow.activeCount * 5);
});
it('does not create a landing burst for a gentle surface contact', () => {
  const spray = new VoxelSpray(),
    r = createRacer(TRACKS[0], 0);
  r.wet = 0;
  r.vy = -0.2;
  spray.update(1 / 60, [r], TRACKS[0], 0);
  r.wet = 1;
  spray.update(1 / 60, [r], TRACKS[0], 1 / 60);
  expect(spray.activeCount).toBe(0);
});
