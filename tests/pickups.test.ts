import { wakeTravel } from '../src/game/water-pulses';
import { describe, expect, it } from 'vitest';
import {
  Pickups,
  pickupRows,
  rollItem,
  RESPAWN,
  MAX_EFFECTS,
  projectileHeight,
} from '../src/game/pickups';
import { createRacer, racePosition, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { waterHeight, waveZoneWeight } from '../src/game/water';
const track = TRACKS[0];
const drive = { throttle: 1, steer: 0, brake: 0, lean: 0 };
const setup = () => {
  const items = new Pickups(track, true, () => 0.5);
  const racers = [createRacer(track, 0), createRacer(track, 1)];
  for (const r of racers)
    Object.assign(r, { x: -100, z: -150, y: waterHeight(-100, -150, 0, track) + 0.6, yaw: 0 });
  racers[1].z += 10;
  return { items, racers };
};
describe('race pickups', () => {
  it('places the Palm reef row after the waves and before the jump straight', () => {
    const reef = track.waveZones!.find((zone) => zone.name === 'Reef wave channel')!;
    const straight = track.waveZones!.find((zone) => zone.name === 'Jump straight')!;
    for (const box of pickupRows(track).filter((box) => box.row === 2)) {
      expect(waveZoneWeight(box.x, box.z, reef)).toBeLessThan(0.1);
      expect(box.z).toBeGreaterThan(reef.z);
      expect(box.z).toBeLessThan(straight.z);
      expect(box.x).toBeGreaterThan(track.ramps[0].x);
    }
  });
  it('places five clear rows with room for each course', () => {
    for (const t of TRACKS) {
      const boxes = pickupRows(t),
        lanes = t.id === 'palms' ? 5 : 3;
      expect(boxes).toHaveLength(5 * lanes);
      expect(new Set(boxes.map((b) => `${b.x},${b.z}`)).size).toBe(5 * lanes);
      for (let row = 0; row < 5; row++)
        expect(boxes.filter((b) => b.row === row)).toHaveLength(lanes);
    }
  });
  it('respects front and back exclusions while keeping random rewards', () => {
    const choices = (rank: number) =>
      new Set(Array.from({ length: 100 }, (_, i) => rollItem(rank, 6, () => i / 100)));
    expect(choices(1)).toEqual(new Set([3, 6]));
    expect(choices(6)).toEqual(new Set([1, 2, 4, 5]));
    expect(choices(3).size).toBe(6);
    for (let i = 0; i < 100; i++) expect([1, 2, 4, 5]).toContain(rollItem(2, 2, () => i / 100));
  });
  it('collects one item, leaves neighboring boxes and respawns after seven seconds', () => {
    const { items, racers } = setup(),
      r = racers[0],
      box = items.boxes[0];
    Object.assign(r, box, { y: waterHeight(box.x, box.z, 0, track) + 1 });
    items.step(1 / 120, 0, racers);
    expect(r.item).toBeGreaterThan(0);
    expect(items.state.cooldowns[0]).toBe(RESPAWN);
    expect(items.state.cooldowns[1]).toBe(0);
    r.x += 100;
    items.step(6, 6, racers);
    expect(items.state.cooldowns[0]).toBe(1);
    items.step(1, 7, racers);
    expect(items.state.cooldowns[0]).toBe(0);
  });
  it('uses press edges, and disabled items have no effects', () => {
    const { items, racers } = setup(),
      r = racers[0];
    r.item = 1;
    items.use(r, true);
    expect(items.state.effects).toHaveLength(1);
    r.item = 1;
    items.use(r, true);
    expect(r.item).toBe(1);
    items.use(r, false);
    items.use(r, true);
    expect(items.state.effects).toHaveLength(2);
    const off = new Pickups(track, false);
    expect(off.boxes).toHaveLength(0);
    r.itemPressed = false;
    off.use(r, true);
    expect(off.state.effects).toHaveLength(0);
  });
  it('direct torpedo hits detonate and shockwaves lift and push racers once', () => {
    const { items, racers } = setup(),
      r = racers[0],
      victim = racers[1];
    r.item = 1;
    items.use(r, true);
    for (let i = 0; i < 12; i++) items.step(1 / 120, 0, racers);
    expect(items.state.effects[0].kind).toBe(4);
    expect(victim.vy).toBeGreaterThan(0);
    expect(victim.vz).toBeGreaterThan(0);
    const vy = victim.vy;
    items.step(1 / 120, 0, racers);
    expect(victim.vy).toBe(vy);
  });
  it('seeking torpedoes turn toward a racer ahead', () => {
    const { items, racers } = setup();
    racers[1].x += 12;
    racers[1].z += 30;
    racers[0].item = 2;
    items.use(racers[0], true);
    items.step(0.1, 0, racers);
    expect(items.state.effects[0].yaw).toBeGreaterThan(0);
  });
  it('mines arm after dropping and waves travel behind their owner', () => {
    const { items, racers } = setup(),
      r = racers[0];
    r.item = 3;
    items.use(r, true);
    const mine = items.state.effects[0];
    Object.assign(racers[1], { x: mine.x, z: mine.z });
    items.step(0.5, 0, racers);
    expect(mine.kind).toBe(3);
    items.step(0.2, 0, racers);
    expect(mine.kind).toBe(4);
    items.state.effects = [];
    r.item = 6;
    r.itemPressed = false;
    items.use(r, true);
    const wave = items.state.effects[0];
    expect(wave.yaw).toBeCloseTo(Math.PI);
    Object.assign(racers[1], { x: wave.x, z: wave.z - wakeTravel(0.5), vy: 0 });
    items.step(0.5, 0, racers);
    expect(racers[1].vy).toBeGreaterThan(0);
  });
  it('boosts increase speed, expire, and only wake boost sheds waves', () => {
    for (const item of [4, 5]) {
      const { items, racers } = setup(),
        r = racers[0],
        plain = structuredClone(r);
      r.item = item;
      items.use(r, true);
      for (let i = 0; i < 240; i++) {
        stepRacer(r, drive, track, i / 120, 1 / 120);
        stepRacer(plain, drive, track, i / 120, 1 / 120);
        items.step(1 / 120, i / 120, [r]);
      }
      expect(Math.hypot(r.vx, r.vz)).toBeGreaterThan(Math.hypot(plain.vx, plain.vz) * 1.1);
      expect(items.state.effects.some((e) => e.kind === 5)).toBe(item === 5);
      for (let i = 0; i < 600; i++) stepRacer(r, drive, track, i / 120, 1 / 120);
      expect(r.boost).toBe(0);
    }
  });
  it('bounds active effects and ignores finished or unmounted racers', () => {
    const { items, racers } = setup(),
      r = racers[0];
    for (let i = 0; i < 100; i++) {
      r.item = 3;
      r.itemPressed = false;
      items.use(r, true);
    }
    expect(items.state.effects).toHaveLength(MAX_EFFECTS);
    r.finished = true;
    r.item = 4;
    r.itemPressed = false;
    items.use(r, true);
    expect(r.item).toBe(4);
    items.step(20, 0, []);
    expect(items.state.effects).toHaveLength(0);
  });
});

it('a trailing racer keeps catch-up odds after the leaders finish', () => {
  const items = new Pickups(track, true, () => 0.999);
  const racers = Array.from({ length: 6 }, (_, i) => createRacer(track, i));
  racers.slice(0, 5).forEach((r) => (r.finished = true));
  const r = racers[5],
    box = items.boxes[0];
  Object.assign(r, box, { y: waterHeight(box.x, box.z, 0, track) + 1 });
  items.step(1 / 120, 0, racers);
  expect(r.item).toBe(5);
});

it('blocks use during the reveal and requires a fresh press after settling', () => {
  const { items, racers } = setup(),
    r = racers[0],
    box = items.boxes[0];
  Object.assign(r, box, { y: waterHeight(box.x, box.z, 0, track) + 1 });
  items.step(1 / 120, 0, racers);
  const held = r.item;
  expect(r.itemReadyIn).toBe(0.8);
  items.use(r, true);
  expect(r.item).toBe(held);
  for (let i = 0; i < 120; i++) {
    stepRacer(r, drive, track, i / 120, 1 / 120);
    items.use(r, true);
  }
  expect(r.itemReadyIn).toBe(0);
  expect(r.item).toBe(held);
  items.use(r, false);
  items.use(r, true);
  expect(r.item).toBe(0);
});

it('awards leader items for every roll, including tied HUD leaders and solo racers', () => {
  for (const count of [1, 2, 6, 10]) {
    for (let roll = 0; roll < 100; roll++) {
      const items = new Pickups(track, true, () => roll / 100);
      const racers = Array.from({ length: count }, (_, i) => createRacer(track, i));
      const collector = racers.at(-1)!,
        box = items.boxes[0];
      for (const r of racers) Object.assign(r, { passed: 5, nextGate: 10, x: -1000, z: -1000 });
      Object.assign(collector, box, { y: waterHeight(box.x, box.z, 0, track) + 1 });
      expect(racePosition(collector, racers, track)).toBe(1);
      items.step(1 / 120, 0, racers);
      expect([3, 6]).toContain(collector.item);
    }
  }
});

it('uses position at collection and preserves held rewards when the racer takes the lead', () => {
  const items = new Pickups(track, true, () => 0.99);
  const racers = [createRacer(track, 0), createRacer(track, 1)];
  const r = racers[1],
    box = items.boxes[0];
  racers[0].passed = 5;
  Object.assign(r, box, { y: waterHeight(box.x, box.z, 0, track) + 1 });
  expect(racePosition(r, racers, track)).toBe(2);
  items.step(1 / 120, 0, racers);
  expect(r.item).toBe(5);
  r.passed = 6;
  expect(racePosition(r, racers, track)).toBe(1);
  items.step(1 / 120, 0, racers);
  expect(r.item).toBe(5);
});

it('mines ride the displaced sea while torpedoes keep their depth through crests', () => {
  const { items } = setup();
  const mine = { id: 1, kind: 3, owner: 0, x: -100, z: -150, yaw: 0, age: 1, hit: 0 };
  items.state.effects = [{ ...mine, id: 2, kind: 5, z: -160, age: 0.5 }];
  const heights = [];
  for (let i = 0; i < 100; i++) {
    const time = i / 20;
    items.waterTime = time;
    const height = projectileHeight(mine, time, items.surface);
    heights.push(height);
    expect(height - waterHeight(mine.x, mine.z, time, items.surface)).toBeCloseTo(0.7);
    for (const kind of [1, 2])
      expect(projectileHeight({ ...mine, kind }, time, items.surface)).toBe(-0.35);
  }
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1);
});

it('a floating mine detects riders on a tall weapon crest and detonates into a shockwave', () => {
  const { items, racers } = setup();
  const mine = { id: 1, kind: 3, owner: 0, x: -100, z: -150, yaw: 0, age: 1, hit: 0 };
  items.state.effects = [
    mine,
    { ...mine, id: 2, kind: 5, z: -150 - wakeTravel(0.55), age: 0.55 },
    { ...mine, id: 3, kind: 5, z: -150 - wakeTravel(0.55), age: 0.55 },
  ];
  const victim = racers[1];
  Object.assign(victim, { x: mine.x, z: mine.z, y: projectileHeight(mine, 0, items.surface) });
  expect(victim.y - waterHeight(victim.x, victim.z, 0, track)).toBeGreaterThan(4);
  items.step(1 / 120, 0, racers);
  expect(mine.kind).toBe(4);
  expect(mine.age).toBe(0);
});

it('tosses a mine from the stern with rider momentum, then floats and arms after landing', () => {
  const { items, racers } = setup();
  const rider = racers[0];
  Object.assign(rider, { item: 3, vx: 0, vz: 24 });
  items.use(rider, true);
  const mine = items.state.effects[0];
  expect(mine.z - rider.z).toBeCloseTo(-1.3);
  const releaseY = projectileHeight(mine, 0, items.surface);
  items.step(0.275, 0.275, []);
  expect(mine.kind).toBe(3);
  expect(projectileHeight(mine, 0.275, items.surface)).toBeGreaterThan(releaseY);
  items.step(0.275, 0.55, []);
  expect(mine.z).toBeCloseTo(rider.z + 24 * 0.55 - 3.6);
  expect(projectileHeight(mine, 0.55, items.surface)).toBeCloseTo(
    waterHeight(mine.x, mine.z, 0.55, items.surface) + 0.7,
  );
  const landedZ = mine.z;
  Object.assign(racers[1], {
    x: mine.x,
    z: mine.z,
    y: projectileHeight(mine, 0.55, items.surface),
  });
  items.step(0.05, 0.6, racers);
  expect(mine.z).toBeCloseTo(landedZ);
  expect(mine.kind).toBe(3);
  items.step(0.1, 0.7, racers);
  expect(mine.kind).toBe(4);
  expect(mine.launch).toBeUndefined();
});

it('releases the wake close to a moving rider before leaving it to expand', () => {
  const { items, racers } = setup();
  const rider = racers[0];
  Object.assign(rider, { item: 6, vz: 30 });
  items.use(rider, true);
  const wave = items.state.effects[0];
  expect(wave.z - rider.z).toBeCloseTo(-1.3);
  items.step(0.2, 0.2, []);
  expect(wave.z).toBeCloseTo(rider.z - 1.3 + 6);
  items.step(0.2, 0.4, []);
  const releasedZ = wave.z;
  expect(releasedZ).toBeCloseTo(rider.z - 1.3 + 9);
  items.step(0.2, 0.6, []);
  expect(wave.z).toBeCloseTo(releasedZ);
});

it('both torpedo variants require close hull contact and miss riders above their path', () => {
  for (const kind of [1, 2]) {
    for (const { side, height, hit } of [
      { side: 1.2, height: 0.6, hit: true },
      { side: 1.5, height: 0.6, hit: false },
      { side: 3, height: 0.6, hit: false },
      { side: 0, height: 1.5, hit: false },
      { side: 0, height: 3, hit: false },
    ]) {
      const { items, racers } = setup();
      const victim = racers[1];
      Object.assign(victim, { x: -100 + side, z: -150, y: height });
      const torpedo = { id: 1, kind, owner: 0, x: -100, z: -150, yaw: 0, age: 0, hit: 0 };
      items.state.effects = [torpedo];
      items.step(1 / 120, 0, racers);
      expect(torpedo.kind, `kind ${kind}, side ${side}, height ${height}`).toBe(hit ? 4 : kind);
    }
  }
});

it('a fast torpedo still detects direct contact between simulation positions', () => {
  const { items, racers } = setup();
  const victim = racers[1];
  Object.assign(victim, { x: -100, z: -145, y: 0.5 });
  const torpedo = { id: 1, kind: 1, owner: 0, x: -100, z: -150, yaw: 0, age: 0, hit: 0 };
  items.state.effects = [torpedo];
  items.step(0.2, 0, racers);
  expect(torpedo.kind).toBe(4);
});
