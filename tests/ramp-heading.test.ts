import { it, expect } from 'vitest';
import { TRACKS } from '../src/game/tracks';
import { createRacer, stepRacer, crossesGate } from '../src/game/physics';
import { waterHeight } from '../src/game/water';
it.each(TRACKS)('ramps point through the next checkpoint on $name', (track) => {
  track.ramps.forEach((ramp) => {
    expect(ramp.targetGate).toBeDefined();
    const gate = track.gates[ramp.targetGate!],
      dx = gate.x - ramp.x,
      dz = gate.z - ramp.z;
    expect(Math.abs(dx * ramp.tz - dz * ramp.tx)).toBeLessThan(gate.width / 2 - 2);
    expect(dx * ramp.tx + dz * ramp.tz).toBeGreaterThan(ramp.length / 2);
    expect(ramp.tx * gate.tx + ramp.tz * gate.tz).toBeGreaterThan(0);
    const r = createRacer(track, 0);
    Object.assign(r, {
      x: ramp.x - ramp.tx * 18,
      z: ramp.z - ramp.tz * 18,
      yaw: Math.atan2(ramp.tx, ramp.tz),
      vx: ramp.tx * 22,
      vz: ramp.tz * 22,
    });
    r.y = waterHeight(r.x, r.z, 0, track) + 0.6;
    let passed = false;
    for (let frame = 0; frame < 120 * 7 && !passed; frame++) {
      const previous = { x: r.x, z: r.z };
      stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, frame / 120, 1 / 120);
      passed = crossesGate(previous, r, gate);
    }
    expect(passed).toBe(true);
  });
});

it.each(TRACKS)('enters the submerged slope without a vertical snap on $name', (track) => {
  for (const ramp of track.ramps) {
    const r = createRacer(track, 0);
    Object.assign(r, {
      x: ramp.x - ramp.tx * (ramp.length / 2 + 2),
      z: ramp.z - ramp.tz * (ramp.length / 2 + 2),
      yaw: Math.atan2(ramp.tx, ramp.tz),
      vx: ramp.tx * 18,
      vz: ramp.tz * 18,
    });
    r.y = waterHeight(r.x, r.z, 0, track) + 0.6;
    let contacted = false;
    for (let i = 0; i < 120 * 4; i++) {
      const before = r.y,
        wasOnRamp = r.onRamp;
      stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
      if (r.onRamp && !wasOnRamp) {
        contacted = true;
        expect(r.y - before).toBeLessThan(0.15);
      }
    }
    expect(contacted).toBe(true);
    expect(ramp.baseHeight).toBeLessThan(-4);
  }
});

it('leaves each straight ramp quickly and settles before reaching the next one', () => {
  const track = TRACKS[0];
  for (const ramp of track.ramps.filter((r) => r.tx === -1)) {
    const r = createRacer(track, 0);
    Object.assign(r, {
      x: ramp.x - ramp.tx * 18,
      z: ramp.z - ramp.tz * 18,
      yaw: Math.atan2(ramp.tx, ramp.tz),
      vx: ramp.tx * 22,
      vz: ramp.tz * 22,
    });
    r.y = waterHeight(r.x, r.z, 0, track) + 0.6;
    let deckTime = 0,
      airborne = false,
      landed = false;
    for (let i = 0; i < 120 * 4; i++) {
      stepRacer(r, { throttle: 1, steer: 0, brake: 0, lean: 0 }, track, i / 120, 1 / 120);
      if (r.onRamp) deckTime += 1 / 120;
      if (deckTime > 0 && !r.onRamp && r.wet === 0) airborne = true;
      if (airborne && r.wet > 0) {
        landed = true;
        break;
      }
    }
    expect(deckTime).toBeGreaterThan(0.15);
    expect(deckTime).toBeLessThan(0.7);
    expect(landed).toBe(true);
    expect(Math.hypot(r.x - ramp.x, r.z - ramp.z)).toBeLessThan(80);
  }
});
