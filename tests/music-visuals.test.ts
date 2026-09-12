import { expect, it } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import { createWorld } from '../src/game/visuals';
import { createRacer } from '../src/game/physics';
import { Box3, Vector3, LineSegments, LineBasicMaterial } from 'three';
import { createMusicVisuals } from '../src/game/music-visuals';
it.each(TRACKS)('keeps spectrum bars animated after scenery batching on $name', (track) => {
  const world = createWorld(track),
    bars = world.group.getObjectByName('Music spectrum')!.children;
  expect(bars.length).toBeGreaterThan(12);
  const rider = createRacer(track, 0);
  world.update(0, rider, { low: 0, mid: 0, high: 0 });
  const quiet = bars.map((b) => b.scale.y);
  world.update(1, rider, { low: 1, mid: 1, high: 1 });
  bars.forEach((bar, i) => {
    expect(bar.scale.y).toBeGreaterThan(quiet[i]);
    expect(
      track.points.every((p) => Math.hypot(p.x - bar.position.x, p.z - bar.position.z) >= 80),
    ).toBe(true);
  });
  world.dispose();
});
it('omits bars where skyline geometry occupies their location', () => {
  const blocked = new Box3(new Vector3(-1000, -10, -1000), new Vector3(1000, 500, 1000));
  expect(createMusicVisuals(TRACKS[0], [blocked]).group.children).toHaveLength(0);
});

it('pulses the authored rock outlines after batching', () => {
  const world = createWorld(TRACKS[2]),
    rider = createRacer(TRACKS[2], 0);
  const materials: LineBasicMaterial[] = [];
  world.group.traverse((o) => {
    if (
      o instanceof LineSegments &&
      o.material instanceof LineBasicMaterial &&
      !o.material.toneMapped
    )
      materials.push(o.material);
  });
  expect(materials.length).toBeGreaterThan(0);
  world.update(0, rider, { low: 0, mid: 0, high: 0 });
  const quiet = materials.map((m) => m.opacity);
  world.update(1, rider, { low: 1, mid: 1, high: 1 });
  materials.forEach((m, i) => {
    expect(m.opacity).toBeGreaterThan(quiet[i]);
  });
  world.dispose();
});
