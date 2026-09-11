import { expect, it } from 'vitest';
import { NetworkRace } from '../src/multiplayer/race';
import { TRACKS } from '../src/game/tracks';
import { waterHeight } from '../src/game/water';
import {
  encodeMessage,
  NEUTRAL,
  parseMessage,
  validCommands,
  validSnapshot,
} from '../src/multiplayer/protocol';
const members = Array.from({ length: 12 }, (_, slot) => ({
  slot,
  name: `RACER ${slot}`,
  color: slot,
  connected: true,
}));
it.each(TRACKS)('host owns pickups and guest state converges on $name', (track) => {
  const host = new NetworkRace(track, members.slice(0, 2), 0, true, true);
  const guest = new NetworkRace(track, members.slice(0, 2), 1, false, true);
  host.tick = 360;
  host.running = true;
  const box = host.items.boxes[0];
  Object.assign(host.racers[1], box, { y: waterHeight(box.x, box.z, 3, host.track) + 1 });
  host.step(NEUTRAL);
  expect(host.racers[1].item).toBeGreaterThan(0);
  guest.receiveSnapshot(host.snapshot());
  expect(guest.items.state).toEqual(host.items.state);
  expect(guest.player.item).toBe(host.racers[1].item);
  host.racers[1].item = 2;
  host.receiveInput(1, [{ seq: 1, input: { ...NEUTRAL, use: true }, reset: false }]);
  host.step(NEUTRAL);
  expect(host.racers[1].item).toBe(2);
  expect(host.items.state.effects).toHaveLength(0);
  expect(guest.player.itemReadyIn).toBeGreaterThan(0);
  for (let i = 0; i < 100; i++) host.step(NEUTRAL);
  expect(host.racers[1].item).toBe(2);
  host.receiveInput(1, [{ seq: 2, input: NEUTRAL, reset: false }]);
  host.step(NEUTRAL);
  host.receiveInput(1, [{ seq: 3, input: { ...NEUTRAL, use: true }, reset: false }]);
  host.step(NEUTRAL);
  expect(host.racers[1].item).toBe(0);
  expect(host.items.state.effects).toHaveLength(1);
  expect(host.items.state.effects[0].owner).toBe(1);
  for (let i = 0; i < 10; i++) host.step(NEUTRAL);
  expect(host.items.state.effects).toHaveLength(1);
  const message = parseMessage(
    encodeMessage({ type: 'snapshot', race: 1, state: host.snapshot() }),
  );
  expect(message?.type).toBe('snapshot');
  if (message?.type === 'snapshot') guest.receiveSnapshot(message.state);
  expect(guest.items.state).toEqual(host.items.state);
  expect(guest.player.item).toBe(0);
  const previous = structuredClone(guest.items.state);
  guest.receiveSnapshot({ ...host.snapshot(), tick: 1, items: { cooldowns: [], effects: [] } });
  expect(guest.items.state).toEqual(previous);
  const incompatible = { cooldowns: Array(track.id === 'palms' ? 15 : 25).fill(0), effects: [] };
  guest.receiveSnapshot({ ...host.snapshot(), tick: host.tick + 1, items: incompatible });
  expect(guest.items.state).toEqual(previous);
});
it('rejects malformed item state and caps the largest legitimate wire packet', () => {
  const host = new NetworkRace(TRACKS[0], members, 0, true, true);
  for (let i = 0; i < 32; i++) {
    host.player.item = 3;
    host.player.itemPressed = false;
    host.items.use(host.player, true);
  }
  const state = host.snapshot();
  expect(validSnapshot(state)).toBe(true);
  const wire = encodeMessage({ type: 'snapshot', race: 1, state });
  expect(new TextEncoder().encode(JSON.stringify(wire)).length).toBeLessThan(15000);
  expect(parseMessage(wire)?.type).toBe('snapshot');
  state.racers[0].itemReadyIn = 10;
  expect(validSnapshot(state)).toBe(false);
  state.racers[0].itemReadyIn = 0;
  state.items.effects[0].age = NaN;
  expect(validSnapshot(state)).toBe(false);
  state.items.effects[0].age = 0;
  state.items.effects[0].owner = 99;
  expect(validSnapshot(state)).toBe(false);
  expect(validCommands([{ seq: 1, input: { ...NEUTRAL, use: 1 }, reset: false }])).toBe(false);
});
it('disconnected and countdown racers cannot spend items', () => {
  const host = new NetworkRace(TRACKS[0], members.slice(0, 2), 0, true, true);
  host.running = true;
  host.player.item = 1;
  host.racers[1].item = 1;
  host.step({ ...NEUTRAL, use: true });
  expect(host.player.item).toBe(1);
  host.disconnect(1);
  host.tick = 361;
  host.receiveInput(1, [{ seq: 1, input: { ...NEUTRAL, use: true }, reset: false }]);
  host.step(NEUTRAL);
  expect(host.racers[1].item).toBe(1);
  expect(host.items.state.effects).toHaveLength(0);
});

it('preserves mine and wake launches on the wire and rejects invalid flight data', () => {
  const host = new NetworkRace(TRACKS[0], members.slice(0, 2), 0, true, true);
  const guest = new NetworkRace(TRACKS[0], members.slice(0, 2), 1, false, true);
  host.tick = 400;
  for (const item of [3, 6]) {
    Object.assign(host.player, { item, itemPressed: false, vx: 5, vz: 25 });
    host.items.use(host.player, true);
  }
  const state = host.snapshot();
  const message = parseMessage(encodeMessage({ type: 'snapshot', race: 1, state }));
  expect(message?.type).toBe('snapshot');
  if (message?.type === 'snapshot') guest.receiveSnapshot(message.state);
  expect(guest.items.state).toEqual(host.items.state);
  expect(guest.items.state.effects.every((e) => e.launch)).toBe(true);
  state.items.effects[0].launch!.vx = Infinity;
  expect(validSnapshot(state)).toBe(false);
  state.items.effects[0].launch!.vx = 5;
  state.items.effects[0].kind = 4;
  expect(validSnapshot(state)).toBe(false);
});

it('round trips items owned by the last racer and hits on all twelve slots', () => {
  const host = new NetworkRace(TRACKS[0], members, 0, true, true);
  const last = host.racers[11];
  last.item = 3;
  host.items.use(last, true);
  const state = host.snapshot();
  state.items.effects[0].hit = (1 << 12) - 1;
  const decoded = parseMessage(encodeMessage({ type: 'snapshot', race: 1, state }));
  expect(decoded?.type).toBe('snapshot');
  if (decoded?.type === 'snapshot') {
    expect(decoded.state.items.effects[0].owner).toBe(11);
    expect(decoded.state.items.effects[0].hit).toBe(4095);
  }
  state.items.effects[0].hit = 1 << 12;
  expect(validSnapshot(state)).toBe(false);
  state.items.effects[0].hit = 0;
  state.items.effects[0].owner = 12;
  expect(validSnapshot(state)).toBe(false);
});
