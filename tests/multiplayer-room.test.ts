import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room } from '../src/multiplayer/room';
import { NEUTRAL, VERSION } from '../src/multiplayer/protocol';

const mock = vi.hoisted(() => {
  class Emitter {
    listeners = new Map<string, ((value: unknown) => void)[]>();
    on(event: string, fn: (value: unknown) => void) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
    }
    emit(event: string, value?: unknown) {
      for (const fn of this.listeners.get(event) ?? []) fn(value);
    }
  }
  class Channel extends Emitter {
    open = true;
    dataChannel = { bufferedAmount: 0 };
    pair?: Channel;
    constructor(readonly peer: string) {
      super();
    }
    send(data: unknown) {
      queueMicrotask(() => {
        if (this.pair?.open) this.pair.emit('data', structuredClone(data));
      });
    }
    close() {
      if (!this.open) return;
      this.open = false;
      this.emit('close');
      this.pair?.close();
    }
  }
  const peers = new Map<string, FakePeer>();
  class FakePeer extends Emitter {
    channels: Channel[] = [];
    disconnected = false;
    destroyed = false;
    reconnects = 0;
    disconnect() {
      this.disconnected = true;
      this.emit('disconnected', this.id);
    }
    reconnect() {
      this.reconnects++;
      this.disconnected = false;
      queueMicrotask(() => this.emit('open', this.id));
    }
    constructor(readonly id: string) {
      super();
      peers.set(id, this);
      queueMicrotask(() => this.emit('open', id));
    }
    connect(id: string) {
      const local = new Channel(id),
        remote = new Channel(this.id);
      local.pair = remote;
      remote.pair = local;
      this.channels.push(local);
      peers.get(id)!.channels.push(remote);
      queueMicrotask(() => {
        peers.get(id)?.emit('connection', remote);
        local.emit('open');
        remote.emit('open');
      });
      return local;
    }
    destroy() {
      this.channels.forEach((c) => c.close());
      peers.delete(this.id);
    }
  }
  return { FakePeer, peers };
});
vi.mock('peerjs', () => ({ default: mock.FakePeer }));
vi.mock('../src/multiplayer/config', () => ({ peerOptions: async () => ({}) }));
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const rooms: Room[] = [];
const room = () => {
  const r = new Room();
  rooms.push(r);
  return r;
};
async function pair() {
  const host = room(),
    guest = room();
  await host.open(true, 'HOST');
  await settle();
  await guest.open(false, 'GUEST', host.code);
  await settle();
  return { host, guest };
}
beforeEach(() =>
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
  }),
);
afterEach(() => {
  rooms.splice(0).forEach((r) => r.close());
  mock.peers.clear();
  vi.useRealTimers();
});

describe('room ownership and lifecycle', () => {
  it('shares practice, locks riding profiles and starts a fresh race from the lobby', async () => {
    const { host, guest } = await pair();
    expect(host.practice).toBeDefined();
    guest.setRiding(true);
    await settle();
    expect(host.riding).toEqual([1]);
    expect(guest.riding).toEqual([1]);
    const before = guest.members[1].name;
    guest.setProfile('RIDING EDIT', 2);
    await settle();
    expect(host.members[1].name).toBe(before);
    for (let i = 0; i < 240; i++) {
      guest.practice!.step({ ...NEUTRAL, brake: 0, throttle: 1 });
      host.practice!.step(NEUTRAL);
      await settle();
    }
    expect(host.practice!.racers[1].z).toBeGreaterThan(-60);
    // The guest predicts a short batch ahead of the host acknowledgement.
    expect(Math.abs(guest.practice!.player.z - host.practice!.racers[1].z)).toBeLessThan(2);
    const position = host.practice!.racers[1].z;
    host.setTrack(2);
    await settle();
    expect(guest.track).toBe(2);
    expect(host.practice!.racers[1].z).toBe(position);
    guest.setRiding(false);
    await settle();
    expect(host.riding).toEqual([]);
    guest.setProfile('READY', 2);
    await settle();
    expect(host.members[1].name).toBe('READY');
    guest.setRiding(true);
    await settle();
    host.start();
    await settle();
    expect(host.phase).toBe('racing');
    expect(guest.phase).toBe('racing');
    expect(host.practice).toBeUndefined();
    expect(guest.practice).toBeUndefined();
    expect(guest.race!.track.id).toBe('storm');
    expect(guest.race!.countdown).toBe(3);
    expect(guest.race!.player.passed).toBe(0);
    guest.setRiding(false);
    await settle();
    expect(guest.phase).toBe('racing');
  });
  it('ends free ride if the host simulation stalls while signaling stays alive', async () => {
    const { host, guest } = await pair();
    guest.setRiding(true);
    await settle();
    const ended = vi.fn();
    guest.onEnd = ended;
    await vi.advanceTimersByTimeAsync(6000);
    expect(guest.phase).toBe('idle');
    expect(guest.practice).toBeUndefined();
    expect(ended).toHaveBeenCalledWith(expect.stringContaining('host stopped responding'));
    expect(host.members).toHaveLength(1);
  });
  it('binds driving input to the channel and ignores forged host messages', async () => {
    const { host, guest } = await pair();
    host.start();
    await settle();
    expect(host.phase).toBe('racing');
    expect(guest.phase).toBe('racing');
    const channel = [...mock.peers.values()].find((p) => !p.id.includes(`vectide-v${VERSION}-`))!
      .channels[0];
    channel.send({ type: 'prepare', race: 2, members: host.members, track: 2 });
    channel.send({
      type: 'input',
      race: 1,
      commands: [{ seq: 1, input: { ...NEUTRAL, throttle: 1, brake: 0 }, reset: false }],
      slot: 0,
    });
    await settle();
    host.race!.step(NEUTRAL);
    expect(host.track).toBe(0);
    expect(host.race!.snapshot().ack[0]).toBe(0);
    expect(host.race!.snapshot().ack[1]).toBe(1);
  });
  it('syncs profiles only for the sending guest and freezes them when racing', async () => {
    const { host, guest } = await pair();
    guest.setProfile(' NEW NAME ', 2);
    await settle();
    expect(host.members[1]).toMatchObject({ name: 'NEW NAME', color: 2 });
    expect(guest.members[1]).toEqual(host.members[1]);
    host.setProfile('CAPTAIN', 4);
    await settle();
    expect(guest.members[0]).toMatchObject({ name: 'CAPTAIN', color: 4 });
    const channel = [...mock.peers.values()].find((p) => !p.id.includes(`vectide-v${VERSION}-`))!
      .channels[0];
    channel.send({ type: 'profile', name: 'FORGED', color: 3, slot: 0 });
    channel.send({ type: 'profile', name: 'INVALID', color: 99 });
    await settle();
    expect(host.members[0].name).toBe('CAPTAIN');
    expect(host.members[1]).toMatchObject({ name: 'FORGED', color: 3 });
    guest.setProfile('NEW NAME', 2);
    await settle();
    host.start();
    await settle();
    channel.send({ type: 'profile', name: 'MIDRACE', color: 1 });
    await settle();
    expect(host.members[1]).toMatchObject({ name: 'NEW NAME', color: 2 });
    expect(host.race!.racers[1]).toMatchObject({ name: 'NEW NAME', color: '#ffbc57' });
  });
  it.each(['lobby', 'racing'])(
    'preserves the %s through signaling loss and reconnect',
    async (phase) => {
      const { host, guest } = await pair();
      if (phase === 'racing') {
        host.start();
        await settle();
      }
      const race = host.race;
      const ended = vi.fn();
      host.onEnd = ended;
      guest.onEnd = ended;
      for (const peer of mock.peers.values()) {
        peer.emit('error', { type: 'network' });
        peer.disconnect();
      }
      expect(host.signalingConnected).toBe(false);
      expect(guest.signalingConnected).toBe(false);
      expect(host.phase).toBe(phase);
      await vi.advanceTimersByTimeAsync(1000);
      expect(host.signalingConnected).toBe(true);
      expect(guest.signalingConnected).toBe(true);
      expect(host.phase).toBe(phase);
      expect(guest.phase).toBe(phase);
      expect(host.race).toBe(race);
      expect(host.members).toHaveLength(2);
      expect(guest.members).toEqual(host.members);
      expect(
        [...mock.peers.values()].every(
          (peer) => peer.reconnects === 1 && peer.channels.length === 1,
        ),
      ).toBe(true);
      expect(ended).not.toHaveBeenCalled();
    },
  );
  it('does not start the countdown until all racers finish loading', async () => {
    const { host } = await pair();
    const channel = [...mock.peers.values()].find((p) => !p.id.includes(`vectide-v${VERSION}-`))!
      .channels[0];
    const send = channel.send.bind(channel);
    channel.send = (value) => {
      if ((value as { type: string }).type !== 'ready') send(value);
    };
    const ended = vi.fn();
    host.onEnd = ended;
    host.start();
    await settle();
    expect(host.phase).toBe('loading');
    expect(host.race!.running).toBe(false);
    host.race!.step(NEUTRAL);
    expect(host.race!.tick).toBe(0);
    await vi.advanceTimersByTimeAsync(16000);
    expect(host.phase).toBe('idle');
    expect(ended).toHaveBeenCalledWith('A racer did not finish loading. Create a new room.');
  });
  it('ends a stalled race even if the host connection still answers heartbeats', async () => {
    const { host, guest } = await pair();
    const ended = vi.fn();
    guest.onEnd = ended;
    host.start();
    await settle();
    await vi.advanceTimersByTimeAsync(6000);
    expect(guest.phase).toBe('idle');
    expect(ended).toHaveBeenCalledWith(
      'The host stopped responding. Join a new room to race again.',
    );
  });
  it('cleans up a cancelled connection attempt and permits a new room', async () => {
    const host = room();
    const attempt = host.open(true, 'HOST');
    host.close();
    await attempt;
    await settle();
    expect(host.phase).toBe('idle');
    expect(mock.peers.size).toBe(0);
    await host.open(true, 'HOST');
    await settle();
    expect(host.phase).toBe('lobby');
    expect(mock.peers.size).toBe(1);
  });
  it('returns a departed lobby slot to the next racer', async () => {
    const { host, guest } = await pair();
    guest.close();
    await settle();
    expect(host.members).toHaveLength(1);
    const replacement = room();
    await replacement.open(false, 'REPLACEMENT', host.code);
    await settle();
    expect(replacement.slot).toBe(1);
    expect(host.members).toHaveLength(2);
  });
});

it('only the host controls pickups and preparation freezes the shared setting', async () => {
  const { host, guest } = await pair();
  expect(guest.pickups).toBe(true);
  guest.setPickups(false);
  expect(guest.pickups).toBe(true);
  host.setPickups(false);
  await settle();
  expect(guest.pickups).toBe(false);
  host.start();
  await settle();
  expect(host.race!.items.enabled).toBe(false);
  expect(guest.race!.items.enabled).toBe(false);
  host.setPickups(true);
  expect(host.pickups).toBe(false);
});

it('assigns numbered blank-name fallbacks and restores them when custom names are cleared', async () => {
  const host = room(),
    first = room(),
    second = room();
  await host.open(true, '  ');
  await settle();
  await first.open(false, '', host.code);
  await settle();
  await second.open(false, '\u0000\t', host.code);
  await settle();
  expect(host.members.map((m) => m.name)).toEqual(['RACER 1', 'RACER 2', 'RACER 3']);
  expect(first.members).toEqual(host.members);
  first.setProfile('  WAVE RUNNER  ', 2);
  await settle();
  expect(host.members[1].name).toBe('WAVE RUNNER');
  first.setProfile('', 3);
  host.setProfile('', 4);
  await settle();
  expect(host.members[0]).toMatchObject({ name: 'RACER 1', color: 4 });
  expect(host.members[1]).toMatchObject({ name: 'RACER 2', color: 3 });
  expect(second.members).toEqual(host.members);
  expect(host.practice!.racers.map((r) => r.name)).toEqual(['RACER 1', 'RACER 2', 'RACER 3']);
});
