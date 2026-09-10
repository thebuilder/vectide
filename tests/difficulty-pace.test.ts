import { expect, it } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import {
  createRacer,
  stepRacer,
  aiInput,
  updateProgress,
  type Difficulty,
} from '../src/game/physics';
it.each(TRACKS)('Normal is competitive and difficulties stay ordered on $name', (track) => {
  const laps = {} as Record<Difficulty, number>;
  for (const difficulty of ['easy', 'normal', 'expert'] as Difficulty[]) {
    const r = createRacer(track, 1);
    for (let frame = 0; frame < 120 * 240 && !r.finished; frame++) {
      const previous = { x: r.x, z: r.z };
      stepRacer(r, aiInput(r, track, [r], difficulty), track, frame / 120, 1 / 120);
      updateProgress(r, previous, track, frame / 120, 1);
    }
    expect(r.finished).toBe(true);
    expect(r.recovered).toBe(false);
    laps[difficulty] = r.laps[0];
  }
  expect(laps.normal).toBeGreaterThan(track.id === 'palms' ? 95 : 55);
  expect(laps.normal).toBeLessThan(track.id === 'palms' ? 170 : 70);
  expect(laps.normal).toBeLessThan(laps.easy);
  expect(laps.expert).toBeLessThan(laps.normal);
});
