import { expect, it } from 'vitest';
import { createCargoBoat } from '../src/game/cargo-boat';
import { createWorld } from '../src/game/visuals';
import { TRACKS } from '../src/game/tracks';

it('keeps Storm shipping distant throughout its continuous route', () => {
  const track = TRACKS[2],
    boat = createCargoBoat(track);
  for (let t = 0; t <= 600; t += 1) {
    boat.update(t);
    const { x, z } = boat.group.position;
    expect(Math.min(...track.points.map((p) => Math.hypot(x - p.x, z - p.z)))).toBeGreaterThan(180);
    const before = boat.group.position.clone();
    boat.update(t + 1 / 60);
    expect(boat.group.position.distanceTo(before)).toBeLessThan(1);
  }
  boat.update(0);
  const start = boat.group.position.clone();
  boat.update(30);
  expect(boat.group.position.distanceTo(start)).toBeGreaterThan(50);
});

it('replaces Storm dolphins with the cargo boat in the actual world', () => {
  for (const track of TRACKS) {
    const world = createWorld(track);
    expect(!!world.group.getObjectByName('dolphin-pod')).toBe(track.id !== 'storm');
    expect(!!world.group.getObjectByName('offshore-cargo-boat')).toBe(track.id === 'storm');
    world.dispose();
  }
});
