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
    for (let frame = 0; frame < 120 * 150 && !r.finished; frame++) {
      const previous = { x: r.x, z: r.z };
      stepRacer(r, aiInput(r, track, [r], difficulty), track, frame / 120, 1 / 120);
      updateProgress(r, previous, track, frame / 120, 1);
    }
    expect(r.finished).toBe(true);
    expect(r.recovered).toBe(false);
    laps[difficulty] = r.laps[0];
  }
  const previousNormal = { palms: 46.07, harbor: 66.79, storm: 73.23 }[track.id]!;
  expect(laps.normal).toBeLessThan(previousNormal * 0.97);
  expect(laps.normal).toBeLessThan(laps.easy);
  expect(laps.expert).toBeLessThan(laps.normal);
});
