import { expect, it } from 'vitest';
import { NetworkRace } from '../src/multiplayer/race';
import { PRACTICE } from '../src/multiplayer/practice';
import { encodeMessage, NEUTRAL, parseMessage } from '../src/multiplayer/protocol';

const members = Array.from({ length: 2 }, (_, slot) => ({
  slot,
  name: `RACER ${slot}`,
  color: slot,
  connected: true,
}));
const drive = { throttle: 1, brake: 0, steer: 0, lean: 0 };

it('parks settings users, predicts guest riding and confines it without race progress', () => {
  const host = new NetworkRace(PRACTICE, members, 0, true);
  const guest = new NetworkRace(PRACTICE, members, 1, false);
  host.syncLobby(members, [1]);
  guest.syncLobby(members, [1]);
  const parked = { x: host.player.x, z: host.player.z };
  const start = guest.player.z;
  guest.onInput = (commands) => host.receiveInput(1, commands);
  host.onSnapshot = (state) => {
    const decoded = parseMessage(encodeMessage({ type: 'snapshot', race: 0, state }));
    expect(decoded?.type).toBe('snapshot');
    if (decoded?.type === 'snapshot') guest.receiveSnapshot(decoded.state);
  };
  let distance = 0;
  for (let tick = 0; tick < 2400; tick++) {
    guest.step(drive);
    host.step(drive);
    distance = Math.max(distance, guest.player.z - start);
    for (const racer of [...host.racers, ...guest.racers]) {
      expect(Math.hypot(racer.x, racer.z)).toBeLessThanOrEqual(
        PRACTICE.practiceRadius! - 2 + 0.001,
      );
      expect(racer.passed).toBe(0);
      expect(racer.finished).toBe(false);
      expect(racer.laps).toHaveLength(0);
    }
  }
  expect(distance).toBeGreaterThan(80);
  expect(host.player.x).toBe(parked.x);
  expect(host.player.z).toBe(parked.z);
  expect(guest.pendingCount).toBeLessThan(20);
  expect(
    Math.hypot(guest.player.x - host.racers[1].x, guest.player.z - host.racers[1].z),
  ).toBeLessThan(2);
});

it('preserves riders during roster changes and parks them when leaving practice', () => {
  const host = new NetworkRace(PRACTICE, members, 0, true);
  host.syncLobby(members, [0]);
  for (let i = 0; i < 240; i++) host.step(drive);
  const before = { x: host.player.x, z: host.player.z, vx: host.player.vx, vz: host.player.vz };
  host.syncLobby([...members, { ...members[1], slot: 2 }], [0]);
  expect({ x: host.player.x, z: host.player.z, vx: host.player.vx, vz: host.player.vz }).toEqual(
    before,
  );
  host.syncLobby(members, []);
  const dock = { x: host.player.x, z: host.player.z };
  for (let i = 0; i < 120; i++) host.step(drive);
  expect({ x: host.player.x, z: host.player.z }).toEqual(dock);
  expect(host.player.vx).toBe(0);
  expect(host.player.vz).toBe(0);
  expect(host.racers).toHaveLength(2);
});

it('launches off both practice ramps with the normal craft physics', () => {
  for (const ramp of PRACTICE.ramps) {
    const host = new NetworkRace(PRACTICE, [members[0]], 0, true);
    host.syncLobby([members[0]], [0]);
    Object.assign(host.player, {
      x: ramp.x - ramp.tx * 42,
      z: ramp.z - ramp.tz * 42,
      yaw: Math.atan2(ramp.tx, ramp.tz),
    });
    let onRamp = false,
      airborne = false;
    for (let i = 0; i < 800; i++) {
      host.step(drive);
      onRamp ||= host.player.onRamp;
      airborne ||= onRamp && host.player.wet === 0 && host.player.y > 4;
    }
    expect(onRamp).toBe(true);
    expect(airborne).toBe(true);
    expect(host.countdown).toBe(0);
    expect(host.player.passed).toBe(0);
  }
});
