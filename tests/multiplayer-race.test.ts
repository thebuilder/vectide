import { describe, expect, it } from 'vitest';
import { aiInput, createRacer } from '../src/game/physics';
import { TRACKS } from '../src/game/tracks';
import { NetworkRace, interpolateRacer } from '../src/multiplayer/race';
import {
  MAX_RACERS,
  encodeMessage,
  NEUTRAL,
  parseMessage,
  validCommands,
  validSnapshot,
  type Command,
  type RaceSnapshot,
} from '../src/multiplayer/protocol';

const members = Array.from({ length: 12 }, (_, slot) => ({
  slot,
  name: `RACER ${slot + 1}`,
  color: slot,
  connected: true,
}));
const drive = { throttle: 1, steer: 0, brake: 0, lean: 0, trick: 0 };
const command = (seq: number): Command => ({ seq, input: drive, reset: false });

describe('authoritative multiplayer simulation', () => {
  it('autopilots a finished guest through gates while preserving their result', () => {
    const host = new NetworkRace(TRACKS[1], members.slice(0, 2), 0, true);
    const guest = new NetworkRace(TRACKS[1], members.slice(0, 2), 1, false);
    host.running = true;
    host.tick = 360 + 180 * 120;
    const racer = host.racers[1],
      gate = host.track.gates[0];
    Object.assign(racer, {
      x: gate.x,
      z: gate.z,
      vx: gate.tx * 18,
      vz: gate.tz * 18,
      yaw: Math.atan2(gate.tx, gate.tz),
      nextGate: 1,
      finished: true,
      finishTime: 180,
      laps: [60, 60, 60],
      lap: 4,
      passed: 49,
    });
    host.onSnapshot = (snapshot) => guest.receiveSnapshot(snapshot);
    guest.onInput = (commands) => host.receiveInput(1, commands);
    guest.receiveSnapshot(host.snapshot());
    const start = { x: racer.x, z: racer.z };
    for (let tick = 0; tick < 120 * 20; tick++) {
      guest.step({ ...NEUTRAL, steer: 1 });
      host.step(NEUTRAL);
    }
    expect(Math.hypot(racer.x - start.x, racer.z - start.z)).toBeGreaterThan(50);
    expect(racer.nextGate).toBeGreaterThan(1);
    expect(racer.finishTime).toBe(180);
    expect(racer.laps).toEqual([60, 60, 60]);
    expect(racer.passed).toBe(49);
    expect(guest.player.finishTime).toBe(180);
    expect(guest.player.laps).toEqual(racer.laps);
    expect(Math.hypot(guest.player.x - racer.x, guest.player.z - racer.z)).toBeLessThan(1);
    expect(host.player.finished).toBe(false);
  });
  it('finishes a full twelve-racer race with bounded wire snapshots', () => {
    const host = new NetworkRace(TRACKS[0], members, 0, true);
    host.running = true;
    const sequences = Array(12).fill(0);
    let largest = 0;
    host.onSnapshot = (snapshot) => {
      largest = Math.max(
        largest,
        new TextEncoder().encode(
          JSON.stringify(encodeMessage({ type: 'snapshot', race: 1, state: snapshot })),
        ).length,
      );
    };
    for (let tick = 0; tick < 72000 && !host.racers.every((r) => r.finished); tick++) {
      if (tick % 6 === 0)
        for (const racer of host.racers.slice(1)) {
          const input = aiInput(racer, host.track, host.racers, 'normal');
          host.receiveInput(
            racer.id,
            Array.from({ length: 6 }, () => ({ seq: ++sequences[racer.id], input, reset: false })),
          );
        }
      host.step(aiInput(host.player, host.track, host.racers, 'normal'));
    }
    expect(host.racers.every((r) => r.finished)).toBe(true);
    expect(
      host.racers.every((r) => r.laps.length === 3 && r.finishTime > 150 && r.finishTime < 300),
    ).toBe(true);
    expect(validSnapshot(host.snapshot())).toBe(true);
    const decoded = parseMessage(
      encodeMessage({ type: 'snapshot', race: 1, state: host.snapshot() }),
    );
    expect(decoded?.type).toBe('snapshot');
    if (decoded?.type === 'snapshot')
      expect(decoded.state.racers[0].finishTime).toBeCloseTo(host.player.finishTime, 3);
    expect(largest).toBeLessThan(8000);
  }, 30000);

  it('starts twelve unique racers on one grid and holds them for the shared countdown', () => {
    const host = new NetworkRace(TRACKS[0], members, 0, true);
    const start = host.racers.map((r) => [r.x, r.z]);
    expect(new Set(host.racers.map((r) => r.color)).size).toBe(MAX_RACERS);
    expect(new Set(start.map((p) => p.join(','))).size).toBe(MAX_RACERS);
    host.running = true;
    for (let i = 0; i < 360; i++) host.step(drive);
    expect(host.racers.map((r) => [r.x, r.z])).toEqual(start);
    expect(host.time).toBe(0);
    host.step(drive);
    expect(host.time).toBeGreaterThan(0);
    expect(validSnapshot(host.snapshot())).toBe(true);
  });
  it('predicts immediately, replays delayed inputs, ignores old snapshots, and converges', () => {
    const host = new NetworkRace(TRACKS[0], members.slice(0, 2), 0, true);
    const guest = new NetworkRace(TRACKS[0], members.slice(0, 2), 1, false);
    host.running = true;
    for (let i = 0; i < 360; i++) host.step(NEUTRAL);
    guest.receiveSnapshot(host.snapshot());
    let now = 0;
    const inputs: { at: number; commands: Command[] }[] = [];
    const states: { at: number; state: RaceSnapshot }[] = [];
    guest.onInput = (commands) => inputs.push({ at: now + 6, commands });
    host.onSnapshot = (state) => states.push({ at: now + 6, state });
    const start = guest.player.z;
    guest.step(drive);
    expect(guest.player.z).not.toBe(start);
    for (now = 0; now < 720; now++) {
      while (inputs[0]?.at <= now) host.receiveInput(1, inputs.shift()!.commands);
      while (states[0]?.at <= now) {
        const received = parseMessage(
          encodeMessage({ type: 'snapshot', race: 1, state: states.shift()!.state }),
        );
        if (received?.type === 'snapshot') guest.receiveSnapshot(received.state);
      }
      host.step(NEUTRAL);
      guest.step(now < 600 ? drive : NEUTRAL);
    }
    expect(guest.pendingCount).toBeLessThan(40);
    const authoritative = host.racers[1];
    expect(
      Math.hypot(guest.player.x - authoritative.x, guest.player.z - authoritative.z),
    ).toBeLessThan(2);
    const tick = guest.tick;
    guest.receiveSnapshot({ ...host.snapshot(), tick: 1 });
    expect(guest.tick).toBe(tick);
    // Forging client-side lap state is corrected by the next authoritative update.
    guest.player.finished = true;
    guest.player.finishTime = 0.01;
    guest.receiveSnapshot({ ...host.snapshot(), tick: host.tick + 1 });
    expect(guest.player.finished).toBe(false);
    expect(guest.player.finishTime).toBe(0);
  });
  it('rejects duplicated and future input and never simulates faster to drain spam', () => {
    const host = new NetworkRace(TRACKS[0], members, 0, true);
    host.running = true;
    host.tick = 360;
    host.receiveInput(1, [command(1), command(1), command(10000)]);
    host.step(NEUTRAL);
    expect(host.snapshot().ack[1]).toBe(1);
    host.step(NEUTRAL);
    expect(host.snapshot().ack[1]).toBe(1);
    for (let i = 2; i < 400; i++) host.receiveInput(1, [command(i)]);
    host.step(NEUTRAL);
    expect(host.snapshot().ack[1]).toBe(2);
    host.disconnect(1);
    host.receiveInput(1, [command(3)]);
    host.step(NEUTRAL);
    expect(host.snapshot().ack[1]).toBe(2);
    expect(host.snapshot().disconnected).toContain(1);
  });
  it('bounds prediction history when the host stops responding', () => {
    const guest = new NetworkRace(TRACKS[0], members, 1, false);
    guest.running = true;
    guest.tick = 360;
    for (let i = 0; i < 1000; i++) guest.step(drive);
    expect(guest.pendingCount).toBe(240);
    expect(Number.isFinite(guest.player.x)).toBe(true);
  });
});

describe('network boundaries and smoothing', () => {
  it('rejects malformed packets before they can reach physics', () => {
    expect(validCommands([{ ...command(1), input: { ...drive, throttle: NaN } }])).toBe(false);
    expect(validCommands([{ ...command(1), input: { ...drive, steer: 2 } }])).toBe(false);
    expect(validCommands(Array.from({ length: 13 }, (_, i) => command(i + 1)))).toBe(false);
    expect(parseMessage({ type: 'position', x: 1, finished: true })).toBeUndefined();
    const host = new NetworkRace(TRACKS[0], members, 0, true);
    const snapshot = host.snapshot();
    snapshot.racers[0].recovery.x = Infinity;
    expect(validSnapshot(snapshot)).toBe(false);
    snapshot.racers[0].recovery.x = 0;
    snapshot.racers[0].nextGate = 2000;
    expect(validSnapshot(snapshot)).toBe(false);
  });
  it('interpolates angles through the wrap, caps extrapolation, and snaps teleports', () => {
    const a = createRacer(TRACKS[0], 0);
    const b = structuredClone(a);
    a.x = 0;
    b.x = 4;
    a.z = b.z = 0;
    b.vx = 20;
    a.yaw = Math.PI - 0.1;
    b.yaw = -Math.PI + 0.1;
    a.air.armed = b.air.armed = true;
    a.air.pitch = Math.PI * 4 - 0.1;
    b.air.pitch = Math.PI * 4 + 0.1;
    a.air.yaw = 0.5;
    b.air.yaw = 0.8;
    const mid = interpolateRacer(a, b, 10, 20, 15);
    expect(mid.x).toBeCloseTo(2);
    expect(mid.yaw).toBeCloseTo(Math.PI);
    expect(mid.air.pitch).toBeCloseTo(Math.PI * 4);
    expect(mid.air.yaw).toBeCloseTo(0.65);
    expect(mid.air).not.toBe(b.air);
    expect(interpolateRacer(a, b, 10, 20, 1000).x).toBe(6);
    b.x = 100;
    expect(interpolateRacer(a, b, 10, 20, 15).x).toBe(100);
  });
});

it.each(TRACKS)(
  'transports the last checkpoint and rejects out-of-range gates on $name',
  (track) => {
    const host = new NetworkRace(track, members.slice(0, 2), 0, true);
    const guest = new NetworkRace(track, members.slice(0, 2), 1, false);
    host.tick = 420;
    host.racers[1].nextGate = track.gates.length - 1;
    const message = parseMessage(
      encodeMessage({ type: 'snapshot', race: 1, state: host.snapshot() }),
    );
    expect(message?.type).toBe('snapshot');
    if (message?.type !== 'snapshot') throw new Error('Snapshot was rejected');
    guest.receiveSnapshot(message.state);
    expect(guest.player.nextGate).toBe(track.gates.length - 1);
    const invalid = structuredClone(message.state);
    invalid.tick++;
    invalid.racers[1].nextGate = track.gates.length;
    expect(validSnapshot(invalid)).toBe(false);
    const before = guest.snapshot();
    guest.receiveSnapshot(invalid);
    expect(guest.snapshot()).toEqual(before);
  },
);

it('round-trips continuous stunt rotation and diving state through a real snapshot', () => {
  const host = new NetworkRace(TRACKS[0], members.slice(0, 2), 0, true);
  Object.assign(host.racers[1].air, {
    armed: true,
    pitch: 9.5,
    yaw: -7.2,
    pitchVelocity: -6.1,
    yawVelocity: 2.4,
    dive: 0.35,
    landings: 3,
    message: '1080 SPIN! LANDED',
    messageTime: 1.7,
  });
  const message = parseMessage(
    encodeMessage({ type: 'snapshot', race: 1, state: host.snapshot() }),
  );
  expect(message?.type).toBe('snapshot');
  if (message?.type !== 'snapshot') throw Error('Snapshot rejected');
  expect(message.state.racers[1].air).toEqual(host.racers[1].air);
  const guest = new NetworkRace(TRACKS[0], members.slice(0, 2), 1, false);
  guest.receiveSnapshot(message.state);
  expect(guest.player.air).toEqual(host.racers[1].air);
});
