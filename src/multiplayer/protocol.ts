import { ITEM_REVEAL_SECONDS, MAX_EFFECTS, type PickupState } from '../game/pickups';
import { createRacer, type Input, type Racer } from '../game/physics';
import { TRACKS } from '../game/tracks';

export const MAX_RACERS = 10;
// Course geometry and handling must match on host and predicting clients.
export const VERSION = 8;
export const STEP = 1 / 120;
export const SEND_EVERY = 6;
export const NEUTRAL: Input = { throttle: 0, steer: 0, brake: 1, lean: 0, trick: 0 };
export const COLORS = [
  '#86fadd',
  '#ff5b82',
  '#ffbc57',
  '#b890ff',
  '#8dbdf5',
  '#ffffff',
  '#d5ef64',
  '#fa92da',
  '#50c7ed',
  '#ffa078',
];
export interface Member {
  slot: number;
  name: string;
  color: number;
  connected: boolean;
}
export interface Command {
  seq: number;
  input: Input;
  reset: boolean;
}
export interface RaceSnapshot {
  tick: number;
  racers: Racer[];
  ack: number[];
  disconnected: number[];
  items: PickupState;
}
export type Message =
  | { type: 'join'; version: number; name: string }
  | { type: 'profile'; name: string; color: number }
  | { type: 'ride'; active: boolean }
  | {
      type: 'lobby';
      members: Member[];
      slot: number;
      track: number;
      pickups: boolean;
      riding: number[];
    }
  | { type: 'prepare'; race: number; members: Member[]; track: number; pickups: boolean }
  | { type: 'ready'; race: number }
  | { type: 'input'; race: number; commands: Command[] }
  | { type: 'snapshot'; race: number; state: RaceSnapshot }
  | { type: 'ping' | 'pong'; at: number }
  | { type: 'reject'; reason: string };

export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number =>
  finite(value, min, max) && Number.isInteger(value);
export const validTrack = (value: unknown): value is number => integer(value, 0, TRACKS.length - 1);
export const defaultRacerName = (slot: number) => `RACER ${slot + 1}`;
export const cleanName = (value: string, fallback = '') =>
  value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, 20) || fallback;
export const validCode = (value: string) => /^[A-Z2-9]{8}$/.test(value);
export function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (n) => alphabet[n % alphabet.length],
  ).join('');
}
export function validCommands(value: unknown): value is Command[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 12 &&
    value.every(
      (c) =>
        record(c) &&
        Object.keys(c).length === 3 &&
        integer(c.seq, 1, 1e9) &&
        typeof c.reset === 'boolean' &&
        record(c.input) &&
        Object.keys(c.input).length <= 6 &&
        finite(c.input.throttle, 0, 1) &&
        finite(c.input.brake, 0, 1) &&
        finite(c.input.steer, -1, 1) &&
        finite(c.input.lean, -1, 1) &&
        integer(c.input.trick ?? 0, -2, 2) &&
        (c.input.use === undefined || typeof c.input.use === 'boolean'),
    )
  );
}
function validMembers(value: unknown): value is Member[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_RACERS &&
    value.every(
      (m) =>
        record(m) &&
        integer(m.slot, 0, MAX_RACERS - 1) &&
        typeof m.name === 'string' &&
        integer(m.color, 0, COLORS.length - 1) &&
        m.name.length <= 20 &&
        typeof m.connected === 'boolean',
    ) &&
    new Set(value.map((m) => m.slot)).size === value.length &&
    value[0].slot === 0
  );
}
// Validate every physics field, including nested recovery and aerial state. The template
// bounds recursion and array sizes; unknown properties are rejected before assignment.
function matches(value: unknown, template: unknown): boolean {
  if (typeof template === 'number') return finite(value, -1e6, 1e6);
  if (typeof template === 'string') return typeof value === 'string' && value.length <= 80;
  if (typeof template === 'boolean') return typeof value === 'boolean';
  if (Array.isArray(template))
    return Array.isArray(value) && value.length <= 3 && value.every((v) => finite(v, 0, 1e6));
  if (!record(value) || !record(template)) return false;
  return (
    Object.keys(value).length === Object.keys(template).length &&
    Object.entries(template).every(([key, t]) => matches(value[key], t))
  );
}
const racerTemplate = createRacer(TRACKS[0], 0);
// Fixed field order removes repeated property names. Four decimals preserve sub-mm
// positions while keeping ten racers comfortably below PeerJS's JSON message limit.
function pack(value: unknown, template: unknown): unknown {
  if (typeof template === 'number') return Math.round((value as number) * 10000) / 10000;
  if (Array.isArray(template)) return (value as number[]).map((n) => Math.round(n * 10000) / 10000);
  if (!record(template)) return value;
  return Object.entries(template).map(([key, shape]) =>
    pack((value as Record<string, unknown>)[key], shape),
  );
}
function unpack(value: unknown, template: unknown): unknown {
  if (!record(template)) return value;
  const entries = Object.entries(template);
  if (!Array.isArray(value) || value.length !== entries.length) return undefined;
  return Object.fromEntries(
    entries.map(([key, shape], index) => [key, unpack(value[index], shape)]),
  );
}
export function encodeMessage(message: Message): unknown {
  if (message.type !== 'snapshot') return message;
  return {
    ...message,
    state: { ...message.state, racers: message.state.racers.map((r) => pack(r, racerTemplate)) },
  };
}
function decodeSnapshot(value: unknown): RaceSnapshot | undefined {
  if (!record(value) || !Array.isArray(value.racers) || value.racers.length > MAX_RACERS) return;
  const state = { ...value, racers: value.racers.map((r) => unpack(r, racerTemplate)) };
  return validSnapshot(state) ? state : undefined;
}
export function validItems(value: unknown): value is PickupState {
  return (
    record(value) &&
    Array.isArray(value.cooldowns) &&
    [0, 25].includes(value.cooldowns.length) &&
    value.cooldowns.every((t) => finite(t, 0, 7)) &&
    Array.isArray(value.effects) &&
    value.effects.length <= MAX_EFFECTS &&
    value.effects.every(
      (e) =>
        record(e) &&
        Object.keys(e).length === (e.launch === undefined ? 8 : 9) &&
        (e.launch === undefined ||
          ((e.kind === 3 || e.kind === 5) &&
            record(e.launch) &&
            Object.keys(e.launch).length === 3 &&
            finite(e.launch.y, -1e4, 1e4) &&
            finite(e.launch.vx, -200, 200) &&
            finite(e.launch.vz, -200, 200))) &&
        integer(e.id, 1, 1e9) &&
        integer(e.kind, 1, 5) &&
        integer(e.owner, 0, 9) &&
        finite(e.x, -1e6, 1e6) &&
        finite(e.z, -1e6, 1e6) &&
        finite(e.yaw, -1e6, 1e6) &&
        finite(e.age, 0, 18) &&
        integer(e.hit, 0, 1023),
    ) &&
    new Set(value.effects.map((e) => e.id)).size === value.effects.length
  );
}
export function validSnapshot(value: unknown): value is RaceSnapshot {
  if (
    !record(value) ||
    !validItems(value.items) ||
    !integer(value.tick, 0, 1e9) ||
    !Array.isArray(value.racers) ||
    value.racers.length < 1 ||
    value.racers.length > MAX_RACERS ||
    !Array.isArray(value.ack) ||
    value.ack.length !== MAX_RACERS ||
    !value.ack.every((a) => integer(a, 0, 1e9)) ||
    !Array.isArray(value.disconnected) ||
    value.disconnected.length > MAX_RACERS ||
    !value.disconnected.every((s) => integer(s, 0, MAX_RACERS - 1))
  )
    return false;
  return (
    value.racers.every(
      (r) =>
        matches(r, racerTemplate) &&
        integer(r.id, 0, MAX_RACERS - 1) &&
        integer(r.item, 0, 6) &&
        finite(r.itemReadyIn, 0, ITEM_REVEAL_SECONDS) &&
        finite(r.boost, 0, 4) &&
        finite(r.boostPower, 1, 2.8) &&
        integer(r.nextGate, 0, TRACKS[0].gates.length - 1) &&
        integer(r.lap, 0, 4) &&
        integer(r.passed, 0, 100) &&
        ['riding', 'falling', 'swimming', 'remounting'].includes(r.recovery.phase) &&
        ['none', 'flip', 'spin'].includes(r.air.trick),
    ) && new Set(value.racers.map((r) => r.id)).size === value.racers.length
  );
}
export function parseMessage(value: unknown): Message | undefined {
  if (!record(value)) return;
  switch (value.type) {
    case 'join':
      if (
        integer(value.version, 0, 100) &&
        typeof value.name === 'string' &&
        value.name.length <= 20
      )
        return value as Message;
      break;
    case 'profile':
      if (
        typeof value.name === 'string' &&
        value.name.length <= 20 &&
        integer(value.color, 0, COLORS.length - 1)
      )
        return value as Message;
      break;
    case 'ride':
      if (typeof value.active === 'boolean') return value as Message;
      break;
    case 'lobby':
      if (
        validMembers(value.members) &&
        integer(value.slot, 0, MAX_RACERS - 1) &&
        validTrack(value.track) &&
        typeof value.pickups === 'boolean' &&
        Array.isArray(value.riding) &&
        value.riding.length <= MAX_RACERS &&
        value.riding.every((slot) =>
          (value.members as Member[]).some((member) => member.slot === slot),
        )
      )
        return value as Message;
      break;
    case 'prepare':
      if (
        validMembers(value.members) &&
        value.members.length >= 2 &&
        validTrack(value.track) &&
        typeof value.pickups === 'boolean' &&
        integer(value.race, 1, 1e9)
      )
        return value as Message;
      break;
    case 'ready':
      if (integer(value.race, 1, 1e9)) return value as Message;
      break;
    case 'input':
      if (integer(value.race, 0, 1e9) && validCommands(value.commands)) return value as Message;
      break;
    case 'snapshot': {
      const state = decodeSnapshot(value.state);
      if (integer(value.race, 0, 1e9) && state)
        return { type: 'snapshot', race: value.race, state };
      break;
    }
    case 'ping':
    case 'pong':
      if (finite(value.at, 0, 1e15)) return value as Message;
      break;
    case 'reject':
      if (typeof value.reason === 'string' && value.reason.length <= 160) return value as Message;
  }
}
