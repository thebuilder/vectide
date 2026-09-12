import { expect, it, vi } from 'vitest';
import * as aerial from '../src/game/aerial';
import { createRacer, rampSurface, stepRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';

it('grades one landing against the deck when water contact and ramp support overlap', () => {
  const ramp = TRACKS[0].ramps[0];
  const track = {
    ...TRACKS[0],
    wave: 0,
    waveZones: [],
    shore: undefined,
    land: [],
    obstacles: [],
    ramps: [ramp],
  };
  const along = -ramp.length / 2 + ((0.05 - ramp.baseHeight) * ramp.length) / ramp.height;
  const r = createRacer(track, 0);
  Object.assign(r, {
    x: ramp.x + ramp.tx * along,
    z: ramp.z + ramp.tz * along,
    y: 0.57,
    vx: ramp.tx * 20,
    vz: ramp.tz * 20,
    vy: -6,
    yaw: Math.atan2(ramp.tx, ramp.tz),
    wet: 0,
  });
  r.body.airtime = 0.3;
  Object.assign(r.air, { armed: true, pitch: Math.PI * 2 });
  expect(rampSurface(r.x, r.z, track)!.height).toBeCloseTo(0.05);
  const land = vi.spyOn(aerial, 'landAerial');
  try {
    stepRacer(r, { throttle: 0, steer: 0, brake: 0, lean: 0 }, track, 1 / 120, 1 / 120);
    expect(r.onRamp).toBe(true);
    expect(land).toHaveBeenCalledTimes(1);
    expect(land.mock.calls[0][2]).toEqual({
      slopeX: (ramp.tx * ramp.height) / ramp.length,
      slopeZ: (ramp.tz * ramp.height) / ramp.length,
      velocity: 0,
    });
    expect(r.air.message).toBe('BACKFLIP LANDED');
    expect(r.recovery.phase).toBe('riding');
  } finally {
    land.mockRestore();
  }
});
