import { expect, it } from 'vitest';
import { Pickups } from '../src/game/pickups';
import {
  aiInput,
  collideRacers,
  createRacer,
  recoverRacer,
  stepRacer,
  updateProgress,
} from '../src/game/physics';
import { checkpointDistance, TRACKS } from '../src/game/tracks';

it.each(TRACKS)(
  'six AI riders finish with pickups on $name',
  (track) => {
    const racers = Array.from({ length: 6 }, (_, i) => createRacer(track, i));
    let seed = 19,
      used = 0;
    const items = new Pickups(track, true, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    });
    const dt = 1 / 120;
    for (let tick = 0; tick < 72000 && !racers.every((r) => r.finished); tick++) {
      const time = tick * dt;
      for (const r of racers) {
        if (r.finished) continue;
        const before = { x: r.x, z: r.z },
          held = r.item;
        items.use(r, tick % 360 === 0);
        if (held && !r.item) used++;
        stepRacer(r, aiInput(r, track, racers, 'normal'), track, time, dt, 1, items.surface);
        updateProgress(r, before, track, time, 3);
        if (
          r.recovery.phase === 'riding' &&
          time - r.lastProgress > Math.max(18, checkpointDistance(track, r.nextGate) / 10 + 8)
        ) {
          recoverRacer(r, track, time);
          r.lastProgress = time;
        }
      }
      for (let a = 0; a < racers.length; a++)
        for (let b = a + 1; b < racers.length; b++) collideRacers(racers[a], racers[b]);
      items.step(dt, time, racers);
    }
    expect(used).toBeGreaterThan(20);
    expect(racers.map((r) => r.finished)).toEqual(Array(6).fill(true));
    expect(racers.every((r) => [r.x, r.y, r.z, r.vx, r.vy, r.vz].every(Number.isFinite))).toBe(
      true,
    );
  },
  30000,
);
