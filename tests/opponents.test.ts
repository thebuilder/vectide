import { expect, it } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import {
  createRacer,
  aiInput,
  catchupPower,
  stepRacer,
  updateProgress,
  collideRacers,
  recoverRacer,
  racePosition,
} from '../src/game/physics';
import { gatePointClear } from '../src/game/course-layout';

it.each(TRACKS)('keeps a rear-grid player identity and reset position on $name', (track) => {
  const player = createRacer(track, 0, 5);
  const grid = [player, ...Array.from({ length: 5 }, (_, i) => createRacer(track, i + 1, i))];
  expect(racePosition(player, grid, track)).toBe(6);
  expect(player.id).toBe(0);
  expect(player.name).toBe('YOU');
  expect(gatePointClear(player.x, player.z, track.land)).toBe(true);
  const start = { x: player.x, z: player.z };
  player.x += 50;
  recoverRacer(player, track, 0, 5);
  expect({ x: player.x, z: player.z }).toEqual(start);
  for (let id = 1; id < 6; id++) {
    const rival = createRacer(track, id, id - 1),
      gate = track.gates[0];
    expect((rival.x - player.x) * gate.tx + (rival.z - player.z) * gate.tz).toBeGreaterThan(0);
  }
});

it('lets a catching rival sustain a higher speed without boosting the player or finished racers', () => {
  const track = TRACKS[1],
    player = createRacer(track, 0),
    r = createRacer(track, 1);
  Object.assign(r, { x: 0, z: -30, yaw: Math.PI, vx: 0, vz: -26, passed: 1, nextGate: 1 });
  const ordinary = aiInput(r, track, [r], 'normal', 1),
    catching = aiInput(r, track, [r], 'normal', 1.12);
  expect(catching.throttle).toBeGreaterThan(ordinary.throttle);
  expect(catching.brake).toBeLessThan(ordinary.brake);
  player.passed = 30;
  expect(catchupPower(player, player, track)).toBe(1);
  expect(catchupPower(r, player, track)).toBe(1.12);
  player.finished = true;
  expect(catchupPower(r, player, track)).toBe(1);
  player.finished = false;
  r.finished = true;
  expect(catchupPower(r, player, track)).toBe(1);
});

function race(track: (typeof TRACKS)[number], catchup: boolean, headStart = 0) {
  const racers = Array.from({ length: 6 }, (_, id) =>
    createRacer(track, id, headStart ? id : (id + 5) % 6),
  );
  const dt = 1 / 60;
  for (let frame = 0; frame < 60 * 300 && !racers.every((r) => r.finished); frame++) {
    for (const r of racers) {
      if (r.finished || (r.id > 0 && frame * dt < headStart)) continue;
      const before = { x: r.x, z: r.z };
      const power = catchup && r.id > 0 ? catchupPower(r, racers[0], track) : 1;
      stepRacer(
        r,
        aiInput(r, track, racers, r.id === 0 ? 'expert' : 'normal', power),
        track,
        frame * dt,
        dt,
        power,
      );
      updateProgress(r, before, track, frame * dt, 3);
    }
    for (let a = 0; a < 6; a++)
      for (let b = a + 1; b < 6; b++)
        if (!racers[a].finished && !racers[b].finished) collideRacers(racers[a], racers[b]);
  }
  expect(racers.every((r) => r.finished)).toBe(true);
  expect(racers.every((r) => !r.recovered)).toBe(true);
  expect(racers.map((r) => r.recovery.crashes)).toEqual([0, 0, 0, 0, 0, 0]);
  return racers;
}

it.each(TRACKS)(
  'keeps Normal rivals in contention for three laps on $name',
  (track) => {
    const racers = race(track, true),
      player = racers[0];
    console.log(
      track.id,
      racers.map((r) => ({
        id: r.id,
        finished: r.finished,
        time: r.finishTime,
        crashes: r.recovery.crashes,
      })),
    );
    const gap = Math.min(
      ...racers.slice(1, 3).map((r) => Math.abs(r.finishTime - player.finishTime)),
    );
    expect(gap).toBeLessThan(10);
  },
  15000,
);

it('reduces the Port lead against the same unassisted field', () => {
  const assisted = race(TRACKS[1], true, 8),
    ordinary = race(TRACKS[1], false, 8);
  const gap = (racers: ReturnType<typeof race>) =>
    Math.min(...racers.slice(1, 3).map((r) => r.finishTime)) - racers[0].finishTime;
  console.log('Port gaps', { assisted: gap(assisted), ordinary: gap(ordinary) });
  expect(gap(assisted)).toBeLessThan(gap(ordinary) - 4);
}, 15000);
