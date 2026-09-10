import { expect, it } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import { aiInput, createRacer, stepRacer, updateProgress } from '../src/game/physics';
import { hullPoints, polygonContact } from '../src/game/hull-contact';
import { Pickups } from '../src/game/pickups';
import { waterHeight, waveZoneWeight } from '../src/game/water';

const track = TRACKS[0];
const dt = 1 / 120;

it('puts a sustained reef wave train on the normal racing line', () => {
  const zone = track.waveZones!.find((zone) => zone.name === 'Reef wave channel')!;
  const r = createRacer(track, 1);
  let exposed = 0,
    launches = 0,
    maxClearance = 0;
  for (let frame = 0; frame < 120 * 90 && !r.finished; frame++) {
    const t = frame * dt,
      before = { x: r.x, z: r.z },
      wet = r.wet;
    stepRacer(r, aiInput(r, track, [r]), track, t, dt);
    updateProgress(r, before, track, t, 1);
    if (waveZoneWeight(r.x, r.z, zone) < 0.4) continue;
    exposed += dt;
    if (wet > 0 && r.wet === 0) launches++;
    maxClearance = Math.max(maxClearance, r.y - waterHeight(r.x, r.z, t, track));
  }
  expect(r.finished).toBe(true);
  expect(r.laps[0]).toBeGreaterThan(55);
  expect(r.laps[0]).toBeLessThan(70);
  expect(exposed).toBeGreaterThan(4);
  expect(launches).toBeGreaterThanOrEqual(3);
  expect(maxClearance).toBeGreaterThan(2);
});

it.each([3, 4, 5])(
  'leaves runoff for missile knockback through Palm checkpoint %s',
  (gateIndex) => {
    const gate = track.gates[gateIndex];
    expect(gate.width).toBeGreaterThanOrEqual(40);
    // Omitting collision response exposes any trajectory that would hit the actual shoreline.
    const openWater = { ...track, land: [], obstacles: [] };
    for (const side of [-1, 1])
      for (const phase of [0, 0.75]) {
        const r = createRacer(track, 0);
        Object.assign(r, {
          x: gate.x - gate.tz * side * 8,
          z: gate.z + gate.tx * side * 8,
          yaw: Math.atan2(gate.tx, gate.tz),
          vx: gate.tx * 18,
          vz: gate.tz * 18,
          nextGate: gateIndex + 1,
        });
        r.y = waterHeight(r.x, r.z, phase, track) + 0.6;
        const items = new Pickups(track, true);
        const explosion = {
          id: 1,
          kind: 4,
          owner: 1,
          x: r.x + gate.tz * side * 2,
          z: r.z - gate.tx * side * 2,
          yaw: r.yaw,
          age: 0,
          hit: 0,
        };
        items.state.effects.push(explosion);
        for (let frame = 0; frame < 120 * 3; frame++) {
          const t = phase + frame * dt,
            before = { x: r.x, z: r.z };
          items.step(dt, t, [r]);
          stepRacer(r, aiInput(r, track, [r]), openWater, t, dt, 1, items.surface);
          updateProgress(r, before, track, t, 3);
          for (const land of track.land)
            expect(
              polygonContact(hullPoints(r), land.outline),
              `${land.name}, gate ${gateIndex}, side ${side}, frame ${frame}`,
            ).toBeNull();
        }
        expect(explosion.hit & 1).toBe(1);
      }
  },
);
