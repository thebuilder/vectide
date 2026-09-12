import { expect, it } from 'vitest';
import { landAerial } from '../src/game/aerial';
import { createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';

function landing(pitch: number, yaw: number) {
  const r = createRacer(TRACKS[0], 0);
  r.pitch = r.roll = r.yaw = 0;
  Object.assign(r.air, { armed: true, pitch: (pitch * Math.PI) / 180, yaw: (yaw * Math.PI) / 180 });
  landAerial(r, -5);
  return r;
}

it.each([
  [0, 180, '180 SPIN'],
  [0, -180, '180 SPIN'],
  [0, 360, '360 SPIN'],
  [0, -720, '720 SPIN'],
  [0, 1080, '1080 SPIN!'],
  [360, 0, 'BACKFLIP'],
  [-360, 0, 'FRONTFLIP'],
  [720, 0, 'DOUBLE BACKFLIP'],
  [-720, 0, 'DOUBLE FRONTFLIP'],
  [360, 360, 'BACKFLIP + 360 SPIN'],
  [350, 340, 'BACKFLIP + 360 SPIN'],
] as const)('names a successful %i degree flip and %i degree spin', (pitch, yaw, name) => {
  const r = landing(pitch, yaw);
  expect(r.air.message).toBe(`${name} LANDED`);
  expect(r.air.messageTime).toBe(2);
  expect(r.air.landings).toBe(1);
  expect(r.recovery.phase).toBe('riding');
});

it('does not celebrate ordinary jumps, small turns, or an inverted crash', () => {
  for (const r of [landing(0, 0), landing(0, 90), landing(180, 360)]) {
    expect(r.air.landings).toBe(0);
    expect(r.air.messageTime).toBe(0);
  }
});

it('keeps a landing label through ordinary wave contact and distinguishes repeated tricks', () => {
  const r = landing(0, 360);
  r.air.messageTime = 1.5;
  landAerial(r, -2);
  expect(r.air.landings).toBe(1);
  expect(r.air.messageTime).toBe(1.5);
  expect(r.air.message).toBe('360 SPIN LANDED');
  Object.assign(r.air, { armed: true, yaw: Math.PI * 2 });
  landAerial(r, -5);
  expect(r.air.landings).toBe(2);
  expect(r.air.messageTime).toBe(2);
});
