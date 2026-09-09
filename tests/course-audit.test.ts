import { it, expect } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import {
  createRacer,
  stepRacer,
  aiInput,
  updateProgress,
  type Difficulty,
} from '../src/game/physics';
it('reports authored course navigation', () => {
  for (const track of TRACKS) {
    console.log(
      'layout',
      track.id,
      Math.round(track.length),
      track.ramps.map((r) => r.targetGate),
    );
    for (const difficulty of ['easy', 'normal', 'expert'] as Difficulty[]) {
      const r = createRacer(track, 1);
      let retries = 0,
        air = 0;
      for (let f = 0; f < 120 * 250 && !r.finished; f++) {
        const before = { x: r.x, z: r.z },
          was = r.approachingGate;
        const input = aiInput(r, track, [r], difficulty);
        if (!was && r.approachingGate) retries++;
        stepRacer(r, input, track, f / 120, 1 / 120);
        updateProgress(r, before, track, f / 120, 1);
        air = Math.max(air, r.body.airtime);
      }
      expect(r.finished).toBe(true);
      expect(r.recovered).toBe(false);
      expect(retries).toBeLessThan(3);
      expect(air).toBeGreaterThan(0.5);
    }
  }
}, 30000);
