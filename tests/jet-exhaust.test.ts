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
  expect(boosted).toBeGreaterThan(fast * 1.8);
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
