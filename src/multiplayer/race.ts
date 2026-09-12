import { Pickups } from '../game/pickups';
import { createLobbyRacers } from './lobby';
import { containPractice } from './practice';
import {
  angle,
  aiInput,
  advanceFinishLap,
  collideRacers,
  createRacer,
  recoverRacer,
  stepRacer,
  updateProgress,
  type Input,
  type Racer,
} from '../game/physics';
import type { Track } from '../game/tracks';
import {
  COLORS,
  MAX_RACERS,
  NEUTRAL,
  SEND_EVERY,
  STEP,
  validCommands,
  type Command,
  type Member,
  type RaceSnapshot,
} from './protocol';

export class NetworkRace {
  readonly racers: Racer[];
  readonly items: Pickups;
  readonly riding = new Set<number>();
  private members: Member[] = [];
  tick = 0;
  running = false;
  readonly disconnected = new Set<number>();
  private queues = Array.from({ length: MAX_RACERS }, () => [] as Command[]);
  private ack = Array<number>(MAX_RACERS).fill(0);
  private lastQueued = Array<number>(MAX_RACERS).fill(0);
  private lastInput = Array.from({ length: MAX_RACERS }, () => ({ ...NEUTRAL }));
  private lastInputTick = Array<number>(MAX_RACERS).fill(-120);
  private lastResetTick = Array<number>(MAX_RACERS).fill(-120);
  private pending: Command[] = [];
  private outgoing: Command[] = [];
  private sequence = 0;
  private resetRequested = false;
  private latestTick = -1;
  private remoteTick = 0;
  private snapshots: RaceSnapshot[] = [];
  private correction = { x: 0, y: 0, z: 0 };
  onInput: (commands: Command[]) => void = () => {};
  onSnapshot: (snapshot: RaceSnapshot) => void = () => {};

  constructor(
    readonly track: Track,
    members: Member[],
    readonly localSlot: number,
    readonly host: boolean,
    pickups = false,
  ) {
    this.items = new Pickups(track, pickups && !track.practiceRadius);
    this.members = members;
    this.racers = members.map((m) =>
      Object.assign(createRacer(track, m.slot), { name: m.name, color: COLORS[m.color] }),
    );
  }
  syncLobby(members: Member[], riding: number[]) {
    if (!this.track.practiceRadius) return;
    this.members = members;
    const docked = createLobbyRacers(this.track, members);
    const removed = this.racers.filter((r) => !members.some((m) => m.slot === r.id));
    for (const racer of removed) {
      this.racers.splice(this.racers.indexOf(racer), 1);
      this.queues[racer.id] = [];
      this.ack[racer.id] = this.lastQueued[racer.id] = 0;
      this.lastInputTick[racer.id] = -120;
    }
    for (const spawn of docked) {
      const current = this.racers.find((r) => r.id === spawn.id);
      if (!current) this.racers.push(spawn);
      else if (!riding.includes(spawn.id)) Object.assign(current, spawn);
      else Object.assign(current, { name: spawn.name, color: spawn.color });
      if (!riding.includes(spawn.id)) {
        this.queues[spawn.id] = [];
        this.lastInputTick[spawn.id] = -120;
      }
    }
    if (!riding.includes(this.localSlot)) {
      this.pending = [];
      this.outgoing = [];
      this.correction = { x: 0, y: 0, z: 0 };
    }
    this.riding.clear();
    riding.forEach((slot) => this.riding.add(slot));
    this.snapshots = [];
    this.running = true;
  }
  get player() {
    return this.racers.find((r) => r.id === this.localSlot)!;
  }
  get time() {
    return Math.max(0, (this.tick - 360) * STEP);
  }
  get countdown() {
    return this.track.practiceRadius ? 0 : Math.max(0, (360 - this.tick) * STEP);
  }
  get pendingCount() {
    return this.pending.length;
  }
  requestReset() {
    if (this.track.practiceRadius || this.tick >= 360) this.resetRequested = true;
  }
  disconnect(slot: number) {
    this.disconnected.add(slot);
    this.queues[slot] = [];
    this.lastInput[slot] = { ...NEUTRAL };
  }
  receiveInput(slot: number, commands: Command[]) {
    if (
      !this.host ||
      !this.running ||
      this.disconnected.has(slot) ||
      slot === this.localSlot ||
      !this.racers.some((r) => r.id === slot) ||
      !validCommands(commands)
    )
      return;
    for (const command of commands) {
      if (
        command.seq <= this.lastQueued[slot] ||
        command.seq > this.lastQueued[slot] + 240 ||
        this.queues[slot].length >= 120
      )
        continue;
      this.queues[slot].push(structuredClone(command));
      this.lastQueued[slot] = command.seq;
    }
  }
  private advance(r: Racer, input: Input, tick: number, reset = false, progress = false) {
    const time = Math.max(0, (tick - 360) * STEP);
    if (reset && !r.finished && tick - this.lastResetTick[r.id] >= 120) {
      if (this.track.practiceRadius) {
        const spawn = createLobbyRacers(this.track, this.members).find((s) => s.id === r.id)!;
        Object.assign(r, spawn);
      } else recoverRacer(r, this.track, tick * STEP);
      this.lastResetTick[r.id] = tick;
    }
    const before = { x: r.x, z: r.z, yaw: r.yaw };
    const docked = !!this.track.practiceRadius && !this.riding.has(r.id);
    if (progress && tick > 360 && !docked && !this.disconnected.has(r.id))
      this.items.use(r, !!input.use);
    stepRacer(
      r,
      docked || this.disconnected.has(r.id)
        ? NEUTRAL
        : r.finished
          ? aiInput(r, this.track, this.racers)
          : input,
      this.track,
      tick * STEP,
      STEP,
      1,
      this.items.surface,
    );
    advanceFinishLap(r, before, this.track);
    if (docked || (!this.track.practiceRadius && tick <= 360))
      Object.assign(r, before, { vx: 0, vz: 0 });
    else if (!this.track.practiceRadius && progress && !this.disconnected.has(r.id))
      updateProgress(r, before, this.track, time, 3);
    if (this.track.practiceRadius) containPractice(r, this.track.practiceRadius);
  }
  step(input: Input) {
    if (!this.running) return;
    this.tick++;
    this.remoteTick++;
    if (this.host) {
      for (const r of this.racers) {
        let control = input,
          reset = this.resetRequested;
        if (r.id !== this.localSlot) {
          const command = this.queues[r.id].shift();
          if (command) {
            this.ack[r.id] = command.seq;
            this.lastInput[r.id] = command.input;
            this.lastInputTick[r.id] = this.tick;
          }
          control = this.tick - this.lastInputTick[r.id] < 30 ? this.lastInput[r.id] : NEUTRAL;
          reset = command?.reset ?? false;
        }
        this.advance(
          r,
          !this.track.practiceRadius && this.tick <= 360 ? NEUTRAL : control,
          this.tick,
          reset,
          true,
        );
      }
      if (this.track.practiceRadius || this.tick > 360)
        for (let a = 0; a < this.racers.length; a++)
          for (let b = a + 1; b < this.racers.length; b++) {
            if (
              (!this.track.practiceRadius ||
                (this.riding.has(this.racers[a].id) && this.riding.has(this.racers[b].id))) &&
              !this.disconnected.has(this.racers[a].id) &&
              !this.disconnected.has(this.racers[b].id) &&
              !this.racers[a].finished &&
              !this.racers[b].finished
            )
              collideRacers(this.racers[a], this.racers[b]);
          }
      if (this.track.practiceRadius)
        this.racers.forEach((r) => containPractice(r, this.track.practiceRadius!));
      if (this.tick > 360)
        this.items.step(
          STEP,
          this.tick * STEP,
          this.racers.filter((r) => !this.disconnected.has(r.id)),
        );
      if (this.tick % SEND_EVERY === 0) this.onSnapshot(this.snapshot());
    } else if ((this.track.practiceRadius || this.tick > 360) && this.pending.length < 240) {
      const command = { seq: ++this.sequence, input: { ...input }, reset: this.resetRequested };
      this.pending.push(command);
      this.outgoing.push(command);
      this.advance(this.player, input, this.tick, command.reset);
      if (this.outgoing.length >= SEND_EVERY) {
        this.onInput(this.outgoing);
        this.outgoing = [];
      }
    }
    this.resetRequested = false;
  }
  snapshot(): RaceSnapshot {
    return structuredClone({
      tick: this.tick,
      racers: this.racers,
      ack: this.ack,
      disconnected: [...this.disconnected],
      items: this.items.state,
    });
  }
  receiveSnapshot(state: RaceSnapshot) {
    if (
      this.host ||
      state.tick <= this.latestTick ||
      state.racers.length !== this.racers.length ||
      state.items.cooldowns.length !== this.items.boxes.length ||
      !state.racers.every(
        (r) =>
          r.nextGate >= 0 &&
          r.nextGate < this.track.gates.length &&
          this.racers.some((local) => local.id === r.id),
      )
    )
      return;
    this.items.state = structuredClone(state.items);
    this.items.waterTime = state.tick * STEP;
    this.latestTick = state.tick;
    this.remoteTick = state.tick;
    this.running = true;
    this.snapshots.push(structuredClone(state));
    this.snapshots = this.snapshots.slice(-10);
    const old = {
      x: this.player.x + this.correction.x,
      y: this.player.y + this.correction.y,
      z: this.player.z + this.correction.z,
    };
    const wasRecovering = this.player.recovered;
    this.disconnected.clear();
    state.disconnected.forEach((s) => this.disconnected.add(s));
    for (const r of state.racers)
      Object.assign(
        this.racers.find((local) => local.id === r.id)!,
        structuredClone(r),
      );
    this.pending = this.pending.filter((c) => c.seq > state.ack[this.localSlot]);
    // Replay only movement. Checkpoints, finish times and traffic impulses belong to the host.
    this.lastResetTick[this.localSlot] = -120;
    this.pending.forEach((c, i) => this.advance(this.player, c.input, state.tick + i + 1, c.reset));
    this.tick = state.tick + this.pending.length;
    const error = Math.hypot(old.x - this.player.x, old.y - this.player.y, old.z - this.player.z);
    this.correction =
      error < 8 && wasRecovering === this.player.recovered
        ? { x: old.x - this.player.x, y: old.y - this.player.y, z: old.z - this.player.z }
        : { x: 0, y: 0, z: 0 };
  }
  renderRacer(r: Racer, dt: number): Racer {
    if (this.host) return r;
    if (r.id === this.localSlot) {
      const decay = Math.exp(-dt * 14);
      this.correction.x *= decay;
      this.correction.y *= decay;
      this.correction.z *= decay;
      return {
        ...r,
        x: r.x + this.correction.x,
        y: r.y + this.correction.y,
        z: r.z + this.correction.z,
      };
    }
    if (!this.snapshots.length) return r;
    // Render 100 ms behind the authoritative clock. Stop after 100 ms of extrapolation.
    const target = Math.min(this.remoteTick - 12, this.latestTick + 12);
    const after = this.snapshots.find((s) => s.tick >= target) ?? this.snapshots.at(-1)!;
    const before = [...this.snapshots].reverse().find((s) => s.tick <= target) ?? after;
    const a = before.racers.find((p) => p.id === r.id)!,
      b = after.racers.find((p) => p.id === r.id)!;
    return interpolateRacer(a, b, before.tick, after.tick, target);
  }
}
export function interpolateRacer(
  a: Racer,
  b: Racer,
  from: number,
  to: number,
  tick: number,
): Racer {
  const alpha = to === from ? 1 : Math.max(0, Math.min(1, (tick - from) / (to - from)));
  if (Math.hypot(a.x - b.x, a.z - b.z) > 8) return b;
  const extra = Math.min(0.1, Math.max(0, (tick - to) * STEP));
  return {
    ...b,
    x: a.x + (b.x - a.x) * alpha + b.vx * extra,
    y: a.y + (b.y - a.y) * alpha + b.vy * extra,
    z: a.z + (b.z - a.z) * alpha + b.vz * extra,
    yaw: a.yaw + angle(b.yaw - a.yaw) * alpha,
    pitch: a.pitch + angle(b.pitch - a.pitch) * alpha,
    roll: a.roll + angle(b.roll - a.roll) * alpha,
    air: {
      ...b.air,
      pitch: a.air.pitch + angle(b.air.pitch - a.air.pitch) * alpha,
      yaw: a.air.yaw + angle(b.air.yaw - a.air.yaw) * alpha,
    },
  };
}
