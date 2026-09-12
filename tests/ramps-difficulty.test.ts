import { it, expect } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import { createRacer, stepRacer, rampSurface, aiInput } from '../src/game/physics';
import { VoxelSpray } from '../src/game/spray';
it('supports the keel on a solid ramp without generating water spray', () => {
  const track = { ...TRACKS[0], wave: 0, obstacles: [] },
    ramp = track.ramps[0],
    r = createRacer(track, 0);
  Object.assign(r, {
    x: ramp.x + ramp.tx * (ramp.length * 0.25),
    z: ramp.z + ramp.tz * (ramp.length * 0.25),
    y: ramp.baseHeight + (0.25 + 0.5) * ramp.height + 0.52,
    yaw: Math.atan2(ramp.tx, ramp.tz),
    vx: ramp.tx * 8,
    vz: ramp.tz * 8,
  });
  const spray = new VoxelSpray();
  let contacts = 0;
  for (let i = 0; i < 40; i++) {
    stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
    if (r.onRamp) {
      contacts++;
      expect(r.y - rampSurface(r.x, r.z, track)!.height).toBeGreaterThanOrEqual(0.519);
      expect(r.wet).toBe(0);
    }
    spray.update(1 / 120, [r], track, i / 120);
  }
  expect(contacts).toBe(40);
  expect(spray.activeCount).toBe(0);
});
it('changes opponent target pace between all three difficulty levels', () => {
  const track = TRACKS[0],
    r = createRacer(track, 1),
    g = track.gates[0];
  r.vx = g.tx * 20;
  r.vz = g.tz * 20;
  const easy = aiInput(r, track, [r], 'easy'),
    normal = aiInput(r, track, [r], 'normal'),
    expert = aiInput(r, track, [r], 'expert');
  expect(easy.throttle).toBeLessThan(normal.throttle);
  expect(easy.brake).toBeGreaterThan(normal.brake);
  expect(expert.throttle).toBeGreaterThanOrEqual(normal.throttle);
});

it.each([-1, 1])('bounces a rider off ramp side %s without lifting them onto the deck', (side) => {
  const track = { ...TRACKS[0], wave: 0, obstacles: [] },
    ramp = track.ramps[0];
  for (const id of [0, 1]) {
    const r = createRacer(track, id),
      sx = -ramp.tz * side,
      sz = ramp.tx * side;
    Object.assign(r, {
      x: ramp.x + ramp.tx * (ramp.length * 0.3) + sx * (ramp.width / 2 + 1),
      z: ramp.z + ramp.tz * (ramp.length * 0.3) + sz * (ramp.width / 2 + 1),
      y: 0.5,
      vx: -sx * 20,
      vz: -sz * 20,
      yaw: Math.atan2(-sx, -sz),
    });
    let bounced = false;
    for (let i = 0; i < 10; i++) {
      stepRacer(r, { throttle: 0, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
      expect(r.onRamp).toBe(false);
      expect(r.y).toBeLessThan(1);
      if (r.vx * sx + r.vz * sz > 0) bounced = true;
    }
    expect(bounced).toBe(true);
  }
});
it('blocks the high rear face but allows an airborne rider to clear a ramp side', () => {
  const track = { ...TRACKS[0], wave: 0, obstacles: [] },
    ramp = track.ramps[0],
    r = createRacer(track, 0);
  Object.assign(r, {
    x: ramp.x + ramp.tx * (ramp.length / 2 + 1),
    z: ramp.z + ramp.tz * (ramp.length / 2 + 1),
    y: 0.5,
    vx: -ramp.tx * 20,
    vz: -ramp.tz * 20,
    yaw: Math.atan2(-ramp.tx, -ramp.tz),
  });
  for (let i = 0; i < 10; i++)
    stepRacer(r, { throttle: 0, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
  expect(r.onRamp).toBe(false);
  expect(r.vx * ramp.tx + r.vz * ramp.tz).toBeGreaterThan(0);
  Object.assign(r, {
    x: ramp.x - ramp.tz * (ramp.width / 2 + 1),
    z: ramp.z + ramp.tx * (ramp.width / 2 + 1),
    y: 8,
    vy: 0,
    vx: ramp.tz * 20,
    vz: -ramp.tx * 20,
  });
  for (let i = 0; i < 10; i++)
    stepRacer(r, { throttle: 0, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
  expect(r.vx * ramp.tz - r.vz * ramp.tx).toBeGreaterThan(0);
  expect(r.y).toBeGreaterThan(7);
});
