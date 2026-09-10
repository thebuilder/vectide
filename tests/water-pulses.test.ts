import { expect, it } from 'vitest';
import { pulseHeight, wakeTravel, wakeWidth } from '../src/game/water-pulses';
import { vertexHeight, waterHeight, type WaterProfile } from '../src/game/water';
import { createRacer, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { pickupRows } from '../src/game/pickups';

it('keeps every pickup outside ramp approaches, decks and landing corridors', () => {
  for (const track of TRACKS)
    for (const box of pickupRows(track))
      for (const ramp of track.ramps) {
        const along = (box.x - ramp.x) * ramp.tx + (box.z - ramp.z) * ramp.tz;
        const side = Math.abs(-(box.x - ramp.x) * ramp.tz + (box.z - ramp.z) * ramp.tx);
        expect(
          side > ramp.width / 2 + 12 ||
            along < -ramp.length / 2 - 60 ||
            along > ramp.length / 2 + 85,
        ).toBe(true);
      }
});
it('adds a traveling crest and trough to the actual ocean height and smoothly expires', () => {
  const pulse = { kind: 5, x: 0, z: 0, yaw: 0, age: 0.5 };
  const surface: WaterProfile = { wave: 1, pulses: [pulse], pulseTime: 0 };
  const crest = wakeTravel(0.5);
  expect(vertexHeight(0, crest, 0, surface) - vertexHeight(0, crest, 0, 1)).toBeGreaterThan(2);
  expect(pulseHeight(0, 0, 0.5, pulse)).toBeLessThan(0);
  expect(pulseHeight(60, 10, 0.5, pulse)).toBe(0);
  expect(pulseHeight(0, 40, 2, pulse)).toBe(0);
  expect(pulseHeight(0, 10, 0, pulse)).toBe(0);
  const later = wakeTravel(1);
  expect(waterHeight(0, later, 0.5, surface) - waterHeight(0, later, 0.5, 1)).toBeGreaterThan(2);
});
it('buoyancy responds to the generated ocean crest without a scripted impulse', () => {
  const track = TRACKS[0];
  const plain = createRacer(track, 0),
    wave = structuredClone(plain);
  Object.assign(plain, { x: -100, z: -150, y: waterHeight(-100, -150, 0, track) + 0.5, yaw: 0 });
  Object.assign(wave, plain);
  const surface: WaterProfile = {
    wave: track.wave,
    waveZones: track.waveZones,
    pulses: [{ kind: 5, x: -100, z: -162, yaw: 0, age: 0 }],
    pulseTime: 0,
  };
  let lift = 0;
  for (let i = 0; i < 120; i++) {
    const t = i / 120,
      input = { throttle: 0, steer: 0, brake: 1, lean: 0 };
    stepRacer(plain, input, track, t, 1 / 120);
    stepRacer(wave, input, track, t, 1 / 120, 1, surface);
    lift = Math.max(lift, wave.y - plain.y);
  }
  expect(lift).toBeGreaterThan(1);
  expect(Number.isFinite(wave.y)).toBe(true);
});

it('builds a narrow wake at release and widens its curved crest across the water', () => {
  expect(wakeTravel(0)).toBe(0);
  expect(wakeWidth(0)).toBe(3);
  expect(wakeWidth(0.4)).toBeGreaterThan(wakeWidth(0.1) * 2);
  const pulse = { kind: 5, x: 0, z: 0, yaw: 0, age: 0 };
  expect(pulseHeight(0, wakeTravel(0.12), 0.12, pulse)).toBeGreaterThan(2);
  expect(pulseHeight(10, 0, 0.05, pulse)).toBe(0);
  const curvedCrest = wakeTravel(0.4) - 100 / (6 + wakeTravel(0.4));
  expect(pulseHeight(10, curvedCrest, 0.4, pulse)).toBeGreaterThan(2);
});
