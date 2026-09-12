import { fitGateToShore, gatePointClear } from './course-layout';
import { angle, clamp, racePosition, rampSurface, type Racer } from './physics';
import type { Track } from './tracks';
import { waterHeight, type WaterProfile } from './water';
import { wakeFront, wakeWidth } from './water-pulses';

export const ITEMS = [
  { name: 'EMPTY', icon: '◇', description: 'Ride through a pickup', color: '#86fadd' },
  { name: 'TORPEDO', icon: '↑', description: 'Fire straight ahead', color: '#ffbc57' },
  { name: 'SEEKING TORPEDO', icon: '◎', description: 'Tracks a racer ahead', color: '#ff5b82' },
  { name: 'SEA MINE', icon: '✳', description: 'Drop behind your craft', color: '#ffbc57' },
  { name: 'JET BOOST', icon: '»', description: 'A short burst of speed', color: '#86fadd' },
  { name: 'WAKE BOOST', icon: '≋', description: 'Surge ahead and shed waves', color: '#50c7ed' },
  { name: 'WAKE EMITTER', icon: '≈', description: 'Send a wave behind you', color: '#b890ff' },
] as const;
export const RESPAWN = 7;
export const ITEM_REVEAL_SECONDS = 0.8;
export const MINE_TOSS_SECONDS = 0.55;
export const MAX_EFFECTS = 32;
export interface Pickup {
  x: number;
  z: number;
  row: number;
}
// Kinds 1–3 are projectiles/mines, 4 is an expanding shockwave, 5 is a moving wake.
export interface ItemEffect {
  id: number;
  kind: number;
  owner: number;
  x: number;
  z: number;
  yaw: number;
  age: number;
  hit: number;
  launch?: { y: number; vx: number; vz: number };
}
export interface PickupState {
  cooldowns: number[];
  effects: ItemEffect[];
}

export function pickupRows(track: Track): Pickup[] {
  if (track.practiceRadius) return [];
  // Palm's reef row rewards clearing the waves, ahead of the long jump straight.
  // Ramp-free rows use lap fractions, independent of checkpoint count, with room to use each item.
  const betweenGates = track.id !== 'palms',
    lanes = betweenGates ? 3 : 5,
    rows =
      track.id === 'storm'
        ? [0.1125, 0.32, 0.53125, 0.71875, 0.90625]
        : betweenGates
          ? [0.09375, 0.28125, 0.46875, 0.65625, 0.84375]
          : [1, 4, 10, 12, 14],
    used = new Set<number>();
  return rows.flatMap((index, row) => {
    // Gates already fit the navigable water. Avoid placing a row on a ramp deck.
    for (let offset = 0; offset < (betweenGates ? 1 : track.gates.length); offset++) {
      const gateIndex = (index + offset) % track.gates.length;
      if (used.has(gateIndex)) continue;
      let gate = track.gates[gateIndex];
      if (betweenGates) {
        const pointIndex = Math.round(gateIndex * track.points.length),
          p = track.points[pointIndex],
          before = track.points[(pointIndex - 1 + track.points.length) % track.points.length],
          after = track.points[(pointIndex + 1) % track.points.length],
          length = Math.hypot(after.x - before.x, after.z - before.z);
        gate = fitGateToShore(
          { ...p, tx: (after.x - before.x) / length, tz: (after.z - before.z) / length, width: 24 },
          track.land,
        );
      }
      const spacing = Math.min(5, (gate.width - 8) / (lanes - 1));
      const points = Array.from({ length: lanes }, (_, lane) => ({
        x: gate.x - gate.tz * (lane - (lanes - 1) / 2) * spacing,
        z: gate.z + gate.tx * (lane - (lanes - 1) / 2) * spacing,
        row,
      }));
      if (
        points.every(
          (p) =>
            gatePointClear(p.x, p.z, track.land) &&
            !rampSurface(p.x, p.z, track) &&
            track.ramps.every((ramp) => {
              const along = (p.x - ramp.x) * ramp.tx + (p.z - ramp.z) * ramp.tz;
              const side = Math.abs(-(p.x - ramp.x) * ramp.tz + (p.z - ramp.z) * ramp.tx);
              return (
                side > ramp.width / 2 + 12 ||
                along < -ramp.length / 2 - 60 ||
                along > ramp.length / 2 + 85
              );
            }) &&
            track.obstacles.every((o) => Math.hypot(p.x - o.x, p.z - o.z) > o.radius + 3),
        )
      ) {
        used.add(gateIndex);
        return points;
      }
    }
    throw new Error(`No clear pickup row on ${track.id} near gate ${index}`);
  });
}
export function rollItem(position: number, count: number, random = Math.random): number {
  const weights =
    position === 1
      ? [0, 0, 3, 0, 0, 7]
      : position > Math.floor((count * 2) / 3)
        ? [2, 3, 0, 3, 4, 0]
        : [3, 2, 2, 3, 2, 3];
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((roll -= weights[i]) < 0) return i + 1;
  return 6;
}
/** Mines float on the displaced surface; torpedoes hold a shallow, level course. */
export function projectileHeight(
  effect: ItemEffect,
  time: number,
  surface: WaterProfile,
  age = effect.age,
): number {
  if (effect.kind !== 3) return -0.35;
  const sea = waterHeight(effect.x, effect.z, time, surface) + 0.7;
  if (!effect.launch || age >= MINE_TOSS_SECONDS) return sea;
  const progress = clamp(age / MINE_TOSS_SECONDS, 0, 1);
  const ease = progress * progress * (3 - 2 * progress);
  return (effect.launch.y + 1.4) * (1 - ease) + sea * ease + Math.sin(progress * Math.PI) * 2.3;
}
export const canUseItem = (r: Racer) => !r.finished && r.recovery.phase === 'riding';
export class Pickups {
  readonly boxes: Pickup[];
  state: PickupState;
  waterTime = 0;
  get surface(): WaterProfile {
    return {
      wave: this.track.wave,
      waveZones: this.track.waveZones,
      shore: this.track.shore,
      pulses: this.state.effects,
      pulseTime: this.waterTime,
    };
  }
  private nextId = 1;
  private wakeClock = new Map<number, number>();
  constructor(
    readonly track: Track,
    readonly enabled: boolean,
    private random = Math.random,
  ) {
    this.boxes = enabled ? pickupRows(track) : [];
    this.state = { cooldowns: this.boxes.map(() => 0), effects: [] };
  }
  use(r: Racer, pressed: boolean) {
    const edge = pressed && !r.itemPressed;
    r.itemPressed = pressed;
    if (!this.enabled || !edge || !r.item || r.itemReadyIn > 0 || !canUseItem(r)) return;
    const item = r.item;
    r.item = 0;
    if (item === 4 || item === 5) {
      r.boost = item === 4 ? 2.5 : 4;
      r.boostPower = item === 4 ? 1.65 : 2.8;
      return;
    }
    const back = item === 3 || item === 6;
    const effect = this.add(
      item === 6 ? 5 : item,
      r.id,
      r.x + Math.sin(r.yaw) * (back ? -1.3 : 4),
      r.z + Math.cos(r.yaw) * (back ? -1.3 : 4),
      r.yaw + (back ? Math.PI : 0),
    );
    if (item === 3 || item === 6)
      effect.launch = {
        y: r.y,
        vx: r.vx - (item === 3 ? Math.sin(r.yaw) * (2.3 / MINE_TOSS_SECONDS) : 0),
        vz: r.vz - (item === 3 ? Math.cos(r.yaw) * (2.3 / MINE_TOSS_SECONDS) : 0),
      };
  }
  private add(kind: number, owner: number, x: number, z: number, yaw: number) {
    // Dropped effects expire early at the cap; the simulation and wire size stay bounded.
    if (this.state.effects.length >= MAX_EFFECTS) this.state.effects.shift();
    const effect: ItemEffect = { id: this.nextId++, kind, owner, x, z, yaw, age: 0, hit: 0 };
    this.state.effects.push(effect);
    return effect;
  }
  step(dt: number, time: number, racers: Racer[]) {
    this.waterTime = time;
    if (!this.enabled) return;
    const active = racers.filter(canUseItem);
    this.state.cooldowns = this.state.cooldowns.map((t) => Math.max(0, t - dt));
    this.boxes.forEach((box, index) => {
      if (this.state.cooldowns[index] > 0) return;
      const r = active.find(
        (r) =>
          !r.item &&
          Math.hypot(r.x - box.x, r.z - box.z) < 3 &&
          Math.abs(r.y - waterHeight(box.x, box.z, time, this.track) - 1) < 3,
      );
      if (!r) return;
      r.item = rollItem(racePosition(r, racers, this.track), racers.length, this.random);
      r.itemReadyIn = ITEM_REVEAL_SECONDS;
      this.state.cooldowns[index] = RESPAWN;
    });
    for (const r of active) {
      const next = (this.wakeClock.get(r.id) ?? 0) - dt;
      if (r.boost > 0 && r.boostPower > 2 && next <= 0) {
        this.add(5, r.id, r.x - Math.sin(r.yaw) * 5, r.z - Math.cos(r.yaw) * 5, r.yaw + Math.PI);
        this.wakeClock.set(r.id, 0.7);
      } else this.wakeClock.set(r.id, next);
    }
    for (const effect of [...this.state.effects]) {
      effect.age += dt;
      if (effect.kind === 5 && effect.launch) {
        const release = Math.min(dt, Math.max(0, 0.3 - (effect.age - dt)));
        effect.x += effect.launch.vx * release;
        effect.z += effect.launch.vz * release;
      }
      if (effect.kind <= 3) this.projectile(effect, dt, time, active);
      else this.wave(effect, active);
    }
    this.state.effects = this.state.effects.filter(
      (e) => e.age < (e.kind === 3 ? 18 : e.kind === 4 ? 1.1 : e.kind === 5 ? 2 : 4),
    );
  }
  private projectile(e: ItemEffect, dt: number, time: number, racers: Racer[]) {
    const oldX = e.x,
      oldZ = e.z;
    if (e.kind === 2) {
      const target = racers
        .filter((r) => r.id !== e.owner)
        .map((r) => ({
          r,
          distance: Math.hypot(r.x - e.x, r.z - e.z),
          turn: angle(Math.atan2(r.x - e.x, r.z - e.z) - e.yaw),
        }))
        .filter((t) => t.distance < 95 && Math.abs(t.turn) < 1.15)
        .sort((a, b) => a.distance - b.distance)[0];
      if (target) e.yaw += clamp(target.turn, -dt * 1.3, dt * 1.3);
    }
    if (e.kind !== 3) {
      e.x += Math.sin(e.yaw) * 58 * dt;
      e.z += Math.cos(e.yaw) * 58 * dt;
    }
    if (e.kind === 3 && e.launch) {
      const flight = Math.min(dt, Math.max(0, MINE_TOSS_SECONDS - (e.age - dt)));
      e.x += e.launch.vx * flight;
      e.z += e.launch.vz * flight;
    }
    if (e.kind === 3 && e.age < 0.65) return;
    const hit = racers.some((r) => {
      if (
        (r.id === e.owner && e.kind !== 3) ||
        Math.abs(r.y - projectileHeight(e, time, this.surface)) > (e.kind === 3 ? 4 : 1.25)
      )
        return false;
      const dx = e.x - oldX,
        dz = e.z - oldZ;
      const t = clamp(((r.x - oldX) * dx + (r.z - oldZ) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      return Math.hypot(r.x - oldX - dx * t, r.z - oldZ - dz * t) < (e.kind === 3 ? 3.5 : 1.3);
    });
    if (
      hit ||
      !gatePointClear(e.x, e.z, this.track.land) ||
      this.track.obstacles.some((o) => Math.hypot(e.x - o.x, e.z - o.z) < o.radius + 1)
    ) {
      e.kind = 4;
      delete e.launch;
      e.age = 0;
      e.hit = 0;
    }
  }
  private wave(e: ItemEffect, racers: Racer[]) {
    for (const r of racers) {
      if (e.hit & (1 << r.id) || (e.kind === 5 && r.id === e.owner)) continue;
      // Buoyancy owns water contact and vertical lift. A crest transfers its shove only
      // while it touches the hull; proximity below an airborne rider is not a hit.
      if (r.wet === 0 || r.onRamp) continue;
      const dx = r.x - e.x,
        dz = r.z - e.z;
      const d = Math.hypot(dx, dz);
      const along = dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw);
      const side = dx * Math.cos(e.yaw) - dz * Math.sin(e.yaw);
      if (
        e.kind === 4
          ? Math.abs(d - e.age * 23) > 3 || d > 22
          : Math.abs(wakeFront(along, side, e.age)) > 3 || Math.abs(side) > wakeWidth(e.age)
      )
        continue;
      e.hit |= 1 << r.id;
      const power = e.kind === 4 ? 1 - d / 30 : 0.75;
      const nx = e.kind === 4 ? dx / (d || 1) : Math.sin(e.yaw);
      const nz = e.kind === 4 ? dz / (d || 1) : Math.cos(e.yaw);
      r.vx += nx * 12 * power;
      r.vz += nz * 12 * power;
      r.rollVelocity += clamp(side || nx, -1, 1) * power;
    }
  }
}
