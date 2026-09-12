import { it, expect } from 'vitest';
import { JetExhaust } from '../src/game/jet-exhaust';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';

it('grows with speed and boost, then fades on throttle release', () => {
  const exhaust = new JetExhaust();
  const racer = createRacer(TRACKS[0], 0);
  const settle = (throttle: number) => {
    for (let i = 0; i < 60; i++) exhaust.update(racer, 1 / 60, throttle);
    return exhaust.group.scale.z;
  };
  settle(0);
  expect(exhaust.group.visible).toBe(false);
  racer.vz = 4;
  const slow = settle(1);
  racer.vz = 28;
  const fast = settle(1);
  expect(fast).toBeGreaterThan(slow * 2);
  racer.boost = 2;
  racer.boostPower = 2.8;
  const boosted = settle(1);
  expect(boosted).toBeGreaterThan(fast * 1.3);
  expect(fast).toBeLessThan(1);
  expect(boosted).toBeLessThan(1.5);
  const beforePause = exhaust.group.scale.clone();
  exhaust.update(racer, 0, 1);
  expect(exhaust.group.scale.toArray()).toEqual(beforePause.toArray());
  settle(0);
  expect(exhaust.group.visible).toBe(false);
});
it('shuts off when the rider is thrown from the craft', () => {
  const exhaust = new JetExhaust();
  const racer = createRacer(TRACKS[0], 0);
  racer.vz = 25;
  racer.recovery.phase = 'falling';
  for (let i = 0; i < 60; i++) exhaust.update(racer, 1 / 60, 1);
  expect(exhaust.group.visible).toBe(false);
});

it('reduces the plume in flight, including boost, and restores it after contact', () => {
  const exhaust = new JetExhaust(),
    r = createRacer(TRACKS[0], 0);
  Object.assign(r, { vz: 28, boost: 2, boostPower: 2.8, wet: 1 });
  for (let i = 0; i < 60; i++) exhaust.update(r, 1 / 60, 1);
  const powered = exhaust.group.scale.clone();
  r.wet = 0;
  r.onRamp = false;
  for (let i = 0; i < 9; i++) exhaust.update(r, 1 / 60, 1);
  expect(exhaust.group.scale.z).toBeLessThan(powered.z * 0.2);
  for (let i = 0; i < 15; i++) exhaust.update(r, 1 / 60, 1);
  expect(exhaust.group.scale.z).toBeLessThan(powered.z * 0.15);
  expect(exhaust.group.scale.x).toBeLessThan(powered.x * 0.3);
  r.onRamp = true;
  for (let i = 0; i < 30; i++) exhaust.update(r, 1 / 60, 1);
  expect(exhaust.group.scale.z).toBeGreaterThan(powered.z * 0.85);
});
