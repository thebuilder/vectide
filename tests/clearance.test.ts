import { it, expect } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import { createWorld } from '../src/game/visuals';
it('keeps scenery out of the racing corridor', () => {
  for (const track of TRACKS) {
    const world = createWorld(track);
    const bad = track.obstacles
      .map((o) => ({
        o,
        clearance:
          Math.min(...track.points.map((p) => Math.hypot(p.x - o.x, p.z - o.z))) - o.radius,
      }))
      .filter((o) => o.clearance < 18);
    console.log(track.id, JSON.stringify(bad));
    world.dispose();
    expect(bad).toHaveLength(0);
  }
});
