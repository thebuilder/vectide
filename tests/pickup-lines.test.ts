import { expect, it } from 'vitest';
import { gatePointClear } from '../src/game/course-layout';
import { pickupRows } from '../src/game/pickups';
import { TRACKS } from '../src/game/tracks';

const storm = TRACKS[2];

it.each([0, 1, 2, 3, 4])(
  'puts Storm pickup row %i across the clear line to the next checkpoint',
  (row) => {
    const from = storm.gates[row + 1];
    const to = storm.gates[(row + 2) % storm.gates.length];
    const dx = to.x - from.x,
      dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    for (let distance = 0; distance <= length; distance++) {
      const x = from.x + (dx * distance) / length;
      const z = from.z + (dz * distance) / length;
      expect(gatePointClear(x, z, storm.land), `${from.name}, ${distance}m`).toBe(true);
      expect(storm.obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + 3)).toBe(true);
    }
    const boxes = pickupRows(storm).filter((box) => box.row === row);
    const side = (box: { x: number; z: number }) =>
      ((box.x - from.x) * dz - (box.z - from.z) * dx) / length;
    expect(Math.min(...boxes.map((box) => Math.abs(side(box))))).toBeLessThan(3);
    for (const box of boxes) expect(gatePointClear(box.x, box.z, storm.land)).toBe(true);
  },
);

it('spaces Storm pickups around the direct riding lap, including the finish', () => {
  const boxes = pickupRows(storm).filter((_, i) => i % 3 === 1);
  const lengths = storm.gates.map((from, i) => {
    const to = storm.gates[(i + 1) % storm.gates.length];
    return Math.hypot(to.x - from.x, to.z - from.z);
  });
  const lap = lengths.reduce((sum, length) => sum + length, 0);
  const distances = boxes.map((box, row) => {
    const from = storm.gates[row + 1];
    return (
      lengths.slice(0, row + 1).reduce((sum, length) => sum + length, 0) +
      Math.hypot(box.x - from.x, box.z - from.z)
    );
  });
  distances.forEach((distance, row) => {
    const gap = (distances[(row + 1) % distances.length] - distance + lap) % lap;
    // Leave at least five seconds between rows at a 24 m/s riding speed.
    expect(gap).toBeGreaterThan(120);
    expect(gap).toBeLessThan(280);
  });
});

it.each([
  { track: TRACKS[1], name: 'Harbor mouth' },
  { track: TRACKS[1], name: 'Cargo south passage' },
  { track: storm, name: 'East channel' },
])('fills the usable water at $name with its checkpoint opening', ({ track, name }) => {
  const gate = track.gates.find((gate) => gate.name === name)!;
  for (let offset = -gate.width / 2; offset <= gate.width / 2; offset += 0.5) {
    expect(gatePointClear(gate.x - gate.tz * offset, gate.z + gate.tx * offset, track.land)).toBe(
      true,
    );
  }
  // The flags end at the hull-safe shore margin, with no navigable lane outside them.
  for (const side of [-1, 1]) {
    const offset = side * (gate.width / 2 + 1);
    expect(gatePointClear(gate.x - gate.tz * offset, gate.z + gate.tx * offset, track.land)).toBe(
      false,
    );
  }
});

it('collects every Storm row while steering toward checkpoints without targeting pickups', async () => {
  const { Pickups } = await import('../src/game/pickups');
  const { angle, clamp, createRacer, stepRacer, updateProgress } =
    await import('../src/game/physics');
  const racer = createRacer(storm, 0);
  const items = new Pickups(storm, true);
  const collected = new Set<number>();
  for (let frame = 0; frame < 120 * 70 && !racer.finished; frame++) {
    const before = { x: racer.x, z: racer.z };
    const gate = storm.gates[racer.nextGate];
    const turn = angle(Math.atan2(gate.x - racer.x, gate.z - racer.z) - racer.yaw);
    const speed = Math.hypot(racer.vx, racer.vz);
    const targetSpeed = 23 - Math.min(Math.abs(turn) * 14, 18);
    stepRacer(
      racer,
      {
        throttle: clamp((targetSpeed - speed) * 0.4 + 0.65, 0, 1),
        brake: clamp((speed - targetSpeed - 1) / 12, 0, 0.7),
        steer: clamp(turn * 2.4, -1, 1),
        lean: 0,
      },
      storm,
      frame / 120,
      1 / 120,
    );
    updateProgress(racer, before, storm, frame / 120, 1);
    items.step(1 / 120, frame / 120, [racer]);
    items.state.cooldowns.forEach((cooldown, index) => {
      if (cooldown > 0) collected.add(items.boxes[index].row);
    });
    // Free the inventory so the next row can be checked without weapon effects changing the line.
    racer.item = 0;
    racer.itemReadyIn = 0;
  }
  expect(racer.finished).toBe(true);
  expect(racer.recovery.crashes).toBe(0);
  expect([...collected].sort()).toEqual([0, 1, 2, 3, 4]);
});
