import { expect, it } from 'vitest';
import { TRACKS } from '../src/game/tracks';
it('Palm final approach aligns with the finish instead of turning across it', () => {
  const track = TRACKS[0],
    finish = track.gates[0],
    last = track.gates.at(-1)!;
  const dx = finish.x - last.x,
    dz = finish.z - last.z;
  const alignment = (dx * finish.tx + dz * finish.tz) / Math.hypot(dx, dz);
  expect(alignment).toBeGreaterThan(Math.cos((35 * Math.PI) / 180));
});
