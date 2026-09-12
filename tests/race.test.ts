import { it, expect } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import {
  aiInput,
  catchupPower,
  collideRacers,
  createRacer,
  recoverRacer,
  stepRacer,
  updateProgress,
} from '../src/game/physics';
import { createWorld } from '../src/game/visuals';

it.each(TRACKS)(
  'six riders finish three laps on $name with scenery collisions',
  (track) => {
    const world = createWorld(track);
    expect(track.obstacles.length + track.land.length).toBeGreaterThan(5);
    const racers = Array.from({ length: 6 }, (_, i) => createRacer(track, i));
    let hits = 0;
    for (let tick = 0; tick < 120 * 560 && racers.some((r) => !r.finished); tick++) {
      const time = tick / 120;
      for (const r of racers) {
        if (r.finished) continue;
        const previous = { x: r.x, z: r.z };
        stepRacer(
          r,
          aiInput(r, track, racers),
          track,
          time,
          1 / 120,
          catchupPower(r, racers[0], track),
        );
        updateProgress(r, previous, track, time, 3);
      }
      for (let a = 0; a < 6; a++)
        for (let b = a + 1; b < 6; b++) if (collideRacers(racers[a], racers[b])) hits++;
    }
    console.log(
      JSON.stringify({
        track: track.id,
        hits,
        riders: racers.map((r) => ({
          name: r.name,
          finished: r.finished,
          laps: r.laps.map(Math.round),
          gate: r.nextGate,
          x: r.x,
          z: r.z,
          progress: r.lastProgress,
          wet: r.wet,
          speed: Math.hypot(r.vx, r.vz),
        })),
      }),
    );
    expect(racers.every((r) => r.finished)).toBe(true);
    expect(racers.every((r) => r.laps.length === 3)).toBe(true);
    world.dispose();
  },
  15000,
);
it('recovery allows immediate throttle without advancing checkpoints or setting an eligible record', () => {
  const track = TRACKS[0],
    r = createRacer(track, 0);
  r.nextGate = track.gates.length - 1;
  r.passed = r.nextGate;
  recoverRacer(r, track, 2);
  expect(r.x).toBe(track.gates.at(-2)!.x);
  expect(r.z).toBe(track.gates.at(-2)!.z);
  expect(r.nextGate).toBe(track.gates.length - 1);
  expect(r.passed).toBe(track.gates.length - 1);
  expect(r.recovered).toBe(true);
  const before = { x: r.x, z: r.z };
  stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, 2, 1 / 120);
  expect(Math.hypot(r.x - before.x, r.z - before.z)).toBeGreaterThan(0);
  expect(Math.hypot(r.vx, r.vz)).toBeGreaterThan(0);
});

it.each(TRACKS)('aligns the whole grid through the start line on $name', (track) => {
  const g = track.gates[0];
  for (let id = 0; id < 6; id++) {
    const r = createRacer(track, id),
      dx = g.x - r.x,
      dz = g.z - r.z;
    expect(Math.sin(r.yaw)).toBeCloseTo(g.tx);
    expect(Math.cos(r.yaw)).toBeCloseTo(g.tz);
    expect(dx * g.tx + dz * g.tz).toBeGreaterThan(0);
    expect(Math.abs(-dx * g.tz + dz * g.tx)).toBeLessThan(g.width / 2);
    if (id === 0) expect(-dx * g.tz + dz * g.tx).toBeCloseTo(0);
  }
});

it('reset before the first crossing returns to the grid, and before the finish returns to the last gate', () => {
  const track = TRACKS[0],
    r = createRacer(track, 0),
    start = { x: r.x, z: r.z };
  r.x += 80;
  r.z += 80;
  recoverRacer(r, track, 5);
  expect(r.x).toBe(start.x);
  expect(r.z).toBe(start.z);
  expect(r.nextGate).toBe(0);
  r.passed = track.gates.length;
  r.nextGate = 0;
  r.lap = 1;
  r.lapStart = 2;
  recoverRacer(r, track, 10);
  expect(r.x).toBe(track.gates.at(-1)!.x);
  expect(r.z).toBe(track.gates.at(-1)!.z);
  expect(r.lap).toBe(1);
  expect(r.lapStart).toBe(2);
  expect(r.passed).toBe(track.gates.length);
});
