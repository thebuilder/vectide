import { createAerialState, stepAerial, landAerial, type AerialState } from './aerial';
import { createRecoveryState, stepRecovery, type RecoveryState } from './recovery';
import { hullPoints, polygonContact } from './hull-contact';
import { collideTerrain } from './terrain-collision';
import { createRiderLoad, stepRiderLoad, type RiderLoad } from './rider-load';
import { collideRampWalls } from './ramp-collision';
import { waterHeight, type WaterProfile } from './water';
import { nearestPoint, routePoint, type Track, type Gate } from './tracks';
export interface Input {
  throttle: number;
  steer: number;
  brake: number;
  lean: number;
  trick?: number;
  use?: boolean;
}
export interface Racer {
  id: number;
  item: number;
  itemPressed: boolean;
  itemReadyIn: number;
  boost: number;
  boostPower: number;
  name: string;
  color: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  roll: number;
  pitchVelocity: number;
  rollVelocity: number;
  steer: number;
  lean: number;
  wet: number;
  onRamp: boolean;
  nextGate: number;
  passed: number;
  lap: number;
  lapStart: number;
  laps: number[];
  finished: boolean;
  finishTime: number;
  lastProgress: number;
  recovered: boolean;
  body: RiderLoad;
  air: AerialState;
  recovery: RecoveryState;
  approachingGate: boolean;
}
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const angle = (n: number) => Math.atan2(Math.sin(n), Math.cos(n));
export function createRacer(track: Track, id: number): Racer {
  const g = track.gates[0],
    back = id === 0 ? 18 : 26 + Math.floor((id - 1) / 2) * 7,
    side = id === 0 ? 0 : (id % 2 === 0 ? -1 : 1) * 4;
  const x = g.x - g.tx * back - g.tz * side,
    z = g.z - g.tz * back + g.tx * side;
  return {
    id,
    item: 0,
    itemPressed: false,
    itemReadyIn: 0,
    boost: 0,
    boostPower: 1,
    name: ['YOU', 'NOVA', 'ECHO', 'FLUX', 'ONYX', 'SOL'][id],
    color: ['#86fadd', '#ff5b82', '#ffbc57', '#b890ff', '#8dbdf5', '#ffffff'][id],
    x,
    y: waterHeight(x, z, 0, track) + 0.6,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.atan2(g.tx, g.tz),
    pitch: 0,
    roll: 0,
    pitchVelocity: 0,
    rollVelocity: 0,
    steer: 0,
    lean: 0,
    wet: 1,
    onRamp: false,
    nextGate: 0,
    passed: 0,
    lap: 0,
    lapStart: 0,
    laps: [],
    finished: false,
    finishTime: 0,
    lastProgress: 0,
    recovered: false,
    body: createRiderLoad(),
    air: createAerialState(),
    recovery: createRecoveryState(),
    approachingGate: false,
  };
}
export function rampSurface(x: number, z: number, track: Track) {
  for (const ramp of track.ramps) {
    const along = (x - ramp.x) * ramp.tx + (z - ramp.z) * ramp.tz;
    const side = -(x - ramp.x) * ramp.tz + (z - ramp.z) * ramp.tx;
    if (Math.abs(side) <= ramp.width / 2 && along >= -ramp.length / 2 && along <= ramp.length / 2)
      return { height: ramp.baseHeight + (along / ramp.length + 0.5) * ramp.height, ramp };
  }
  return null;
}
export function stepRacer(
  r: Racer,
  input: Input,
  track: Track,
  t: number,
  dt: number,
  power = 1,
  surface: WaterProfile = track,
): void {
  r.itemReadyIn = Math.max(0, r.itemReadyIn - dt);
  if (r.boost > 0) {
    r.boost = Math.max(0, r.boost - dt);
    if (r.recovery.phase === 'riding') power *= r.boostPower;
  }
  if (r.recovery.phase !== 'riding') input = { throttle: 0, steer: 0, brake: 0.7, lean: 0 };
  stepAerial(r, input, r.y - waterHeight(r.x, r.z, t, surface), dt);
  stepRiderLoad(r, input, dt);
  const wasAirborne = r.body.airtime > 0.12;
  const entryVelocity = r.vy;
  r.lean += (input.lean - r.lean) * (1 - Math.exp(-dt * 10));
  const previous = { x: r.x, y: r.y, z: r.z };
  const speed = Math.hypot(r.vx, r.vz),
    fx = Math.sin(r.yaw),
    fz = Math.cos(r.yaw),
    rx = fz,
    rz = -fx;
  r.air.dive *= Math.exp(-dt * 3);
  if (
    !r.air.armed &&
    r.body.airtime > 0.12 &&
    input.lean < -0.3 &&
    r.pitch < -0.12 &&
    r.pitch > -0.8 &&
    r.vy < -1 &&
    speed > 8
  )
    r.air.dive = Math.max(r.air.dive, clamp(-r.pitch / 0.45, 0, 1) * clamp(speed / 20, 0, 1));
  let force = 0,
    front = 0,
    back = 0,
    left = 0,
    right = 0,
    contacts = 0;
  const stunt = r.air.armed;
  const contactYaw = r.yaw + r.air.yaw,
    contactPitch = r.pitch + r.air.pitch;
  for (const along of [-1.55, 1.55])
    for (const side of [-0.62, 0.62]) {
      // During a stunt, sample the rotated hull that is actually being drawn.
      const longitudinal = stunt
        ? along * Math.cos(contactPitch) - side * Math.sin(r.roll) * Math.sin(contactPitch)
        : along;
      const lateral = stunt ? side * Math.cos(r.roll) : side;
      const x = r.x + Math.sin(contactYaw) * longitudinal + Math.cos(contactYaw) * lateral,
        z = r.z + Math.cos(contactYaw) * longitudinal - Math.sin(contactYaw) * lateral;
      const localY =
        r.y +
        Math.sin(contactPitch) * along +
        Math.sin(r.roll) * side * (stunt ? Math.cos(contactPitch) : 1);
      const h = waterHeight(x, z, t, surface),
        waterV = (waterHeight(x, z, t + 0.025, surface) - h) / 0.025;
      const immersion = h + 0.48 + Math.min(speed / 120, 0.2) - localY;
      const pointV = stunt
        ? r.vy +
          (Math.cos(contactPitch) * along - Math.sin(r.roll) * side * Math.sin(contactPitch)) *
            (r.pitchVelocity + r.air.pitchVelocity) +
          Math.cos(r.roll) * side * Math.cos(contactPitch) * r.rollVelocity
        : r.vy + r.pitchVelocity * along + r.rollVelocity * side;
      const spring =
        immersion > -0.12
          ? clamp(
              immersion * (30 + Math.max(0, immersion - 0.6) * 22) -
                // A nose-first entry pierces the surface before buoyancy arrests its descent.
                // Keep the spring and full upward damping so the hull always resurfaces.
                (pointV - waterV) * 4.2 * (pointV < waterV ? 1 - r.air.dive * 0.8 : 1),
              0,
              110,
            )
          : 0;
      if (immersion > -0.12) contacts++;
      force += spring / 4;
      if (along > 0) front += spring;
      else back += spring;
      if (side > 0) right += spring;
      else left += spring;
    }
  const height = waterHeight(r.x, r.z, t, surface),
    surfaceV = (waterHeight(r.x, r.z, t + 0.025, surface) - height) / 0.025,
    slopeX =
      (waterHeight(r.x + 1.5, r.z, t, surface) - waterHeight(r.x - 1.5, r.z, t, surface)) / 3,
    slopeZ =
      (waterHeight(r.x, r.z + 1.5, t, surface) - waterHeight(r.x, r.z - 1.5, t, surface)) / 3;
  r.wet = contacts / 4;
  if (r.wet === 0 && !r.onRamp) r.body.airtime += dt;
  else r.body.airtime = 0;
  r.vy += (force - 9.81) * dt;
  r.y += r.vy * dt;
  const targetBank = -r.body.side * 0.82;
  r.pitchVelocity +=
    ((front - back) * 0.19 -
      r.pitchVelocity * 2.8 -
      r.pitch * 2.5 +
      r.body.fore * (stunt ? 0 : 4.8)) *
    dt;
  r.rollVelocity += ((right - left) * 0.25 + (targetBank - r.roll) * 15 - r.rollVelocity * 5) * dt;
  r.pitch = clamp(r.pitch + r.pitchVelocity * dt, -1.15, 1.15);
  r.roll = clamp(r.roll + r.rollVelocity * dt, -0.9, 0.9);
  r.steer += (input.steer - r.steer) * Math.min(1, dt * 7);
  const grip = r.onRamp ? 0.55 : r.wet;
  r.yaw +=
    r.steer *
    (1.02 + Math.abs(r.body.side) * 0.1) *
    clamp(speed / 9, 0, 1) *
    (1 - input.brake * 0.2) *
    grip *
    dt;
  const forward = r.vx * fx + r.vz * fz,
    lateral = r.vx * rx + r.vz * rz;
  // Fast launch, then a longer pull through the upper range without changing cruise speed.
  const response = 1 - 0.65 * clamp((Math.abs(forward) - 8) / 12, 0, 1);
  const thrust = input.throttle * 19 * power * response * grip;
  const drag =
    (0.037 * forward * Math.abs(forward) * response * (0.35 + 0.65 * input.throttle) +
      input.brake * forward * 1.8 +
      r.air.dive * clamp((height + 0.25 - r.y) / 0.75, 0, 1) * forward * 1.4 +
      (1 - input.throttle) * forward * (0.08 + 0.8 * clamp((8 - speed) / 6, 0, 1))) *
    grip;
  const sideDrag = lateral * (2.3 + Math.abs(r.body.side) * 0.3 + input.brake) * grip;
  r.vx += (fx * (thrust - drag) - rx * sideDrag) * dt;
  r.vz += (fz * (thrust - drag) - rz * sideDrag) * dt;
  if (!r.onRamp && r.wet > 0) {
    const waveDrive = clamp(speed / 6, 0, 1);
    r.vx -= slopeX * 4.5 * r.wet * waveDrive * dt;
    r.vz -= slopeZ * 4.5 * r.wet * waveDrive * dt;
    // A descending face travelling with the craft rewards contact, with a finite speed reserve.
    const downhill = Math.max(0, -(slopeX * fx + slopeZ * fz));
    const following = surfaceV > 0 ? 1 : 0;
    const surf =
      Math.min(downhill, 0.6) * following * 7 * clamp((26 - speed) / 4, 0, 1) * waveDrive * r.wet;
    r.vx += fx * surf * dt;
    r.vz += fz * surf * dt;
    r.yaw -= (slopeX * rx + slopeZ * rz) * 0.18 * clamp(speed / 12, 0, 1) * r.wet * dt;
  }
  if (input.throttle === 0 && r.wet > 0 && !r.onRamp && Math.hypot(r.vx, r.vz) < 0.12) {
    r.vx = 0;
    r.vz = 0;
  }
  r.x += r.vx * dt;
  r.z += r.vz * dt;
  // A rigid deck constrains the keel, while its slope supplies takeoff velocity.
  const wallHit = collideRampWalls(r, previous, track);
  const deck = rampSurface(r.x, r.z, track);
  const previousAlong = deck
    ? (previous.x - deck.ramp.x) * deck.ramp.tx + (previous.z - deck.ramp.z) * deck.ramp.tz
    : 0;
  const previousDeck = deck
    ? deck.ramp.baseHeight + (previousAlong / deck.ramp.length + 0.5) * deck.ramp.height
    : 0;
  r.onRamp = false;
  if (!wallHit && deck && previous.y >= previousDeck + 0.52 - 0.03 && r.y <= deck.height + 0.52) {
    const alongVelocity = r.vx * deck.ramp.tx + r.vz * deck.ramp.tz;
    r.y = deck.height + 0.52;
    r.vy = (alongVelocity * deck.ramp.height) / deck.ramp.length;
    const rampPitch =
      Math.atan(deck.ramp.height / deck.ramp.length) * (fx * deck.ramp.tx + fz * deck.ramp.tz);
    r.pitch += (rampPitch - r.pitch) * (1 - Math.exp(-dt * 14));
    r.pitchVelocity = 0;
    r.roll *= Math.exp(-dt * 12);
    r.body.airtime = 0;
    r.onRamp = true;
    r.wet = 0;
  }
  // Resolve the supporting surface once. At a water/deck boundary the rigid deck
  // wins; grading before this point can punish the same touchdown twice.
  if ((wasAirborne || r.air.armed) && (r.wet > 0 || r.onRamp)) {
    const landingSurface =
      r.onRamp && deck
        ? {
            slopeX: (deck.ramp.tx * deck.ramp.height) / deck.ramp.length,
            slopeZ: (deck.ramp.tz * deck.ramp.height) / deck.ramp.length,
            velocity: 0,
          }
        : { slopeX, slopeZ, velocity: surfaceV };
    landAerial(r, entryVelocity, landingSurface);
    if (!r.onRamp) {
      const impact = Math.max(
        0,
        (surfaceV + r.vx * slopeX + r.vz * slopeZ - entryVelocity) / Math.hypot(1, slopeX, slopeZ),
      );
      r.body.impact = Math.min(16, impact);
      const mismatch = Math.abs(
        r.pitch - Math.atan(slopeX * Math.sin(r.yaw) + slopeZ * Math.cos(r.yaw)),
      );
      const scrub = clamp((impact - 2) * (0.009 + Math.min(mismatch, 1) * 0.018), 0, 0.28);
      r.vx *= 1 - scrub;
      r.vz *= 1 - scrub;
    }
  }
  collideTerrain(r, track);
  for (const o of track.obstacles) {
    const dx = r.x - o.x,
      dz = r.z - o.z,
      d = Math.hypot(dx, dz),
      min = o.radius + 1.2;
    if (d < min && d > 0.001) {
      const nx = dx / d,
        nz = dz / d;
      r.x = o.x + nx * min;
      r.z = o.z + nz * min;
      const vn = r.vx * nx + r.vz * nz;
      if (vn < 0) {
        r.vx -= vn * 1.25 * nx;
        r.vz -= vn * 1.25 * nz;
      }
    }
  }
  stepRecovery(r, surface, t, dt);
}

export function collideRacers(a: Racer, b: Racer): boolean {
  if (Math.hypot(b.x - a.x, b.z - a.z) > 4.5 || Math.abs(a.y - b.y) > 0.85) return false;
  const contact = polygonContact(hullPoints(a), hullPoints(b));
  if (!contact) return false;
  const { x: nx, z: nz, depth } = contact;
  a.x -= (nx * depth) / 2;
  a.z -= (nz * depth) / 2;
  b.x += (nx * depth) / 2;
  b.z += (nz * depth) / 2;
  const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (closing < 0) {
    // Equal masses, restitution 0.45: a firm bump without adding linear energy.
    const impulse = -closing * 0.725;
    a.vx -= impulse * nx;
    a.vz -= impulse * nz;
    b.vx += impulse * nx;
    b.vz += impulse * nz;
    const kick = Math.min(-closing * 0.08, 1.2);
    for (const [r, sign] of [
      [a, -1],
      [b, 1],
    ] as const) {
      r.rollVelocity += sign * kick * (nx * Math.cos(r.yaw) - nz * Math.sin(r.yaw));
      r.pitchVelocity += sign * kick * (nx * Math.sin(r.yaw) + nz * Math.cos(r.yaw));
    }
  }
  return true;
}
export function crossesGate(
  previous: { x: number; z: number },
  current: { x: number; z: number },
  g: Gate,
): boolean {
  const before = (previous.x - g.x) * g.tx + (previous.z - g.z) * g.tz;
  const after = (current.x - g.x) * g.tx + (current.z - g.z) * g.tz;
  if (before >= 0 || after < 0) return false;
  const f = -before / (after - before),
    x = previous.x + (current.x - previous.x) * f - g.x,
    z = previous.z + (current.z - previous.z) * f - g.z;
  return Math.abs(-x * g.tz + z * g.tx) <= g.width / 2;
}
export function updateProgress(
  r: Racer,
  previous: { x: number; z: number },
  track: Track,
  time: number,
  totalLaps: number,
): boolean {
  if (
    r.finished ||
    r.recovery.phase !== 'riding' ||
    !crossesGate(previous, r, track.gates[r.nextGate])
  )
    return false;
  const wasStart = r.nextGate === 0;
  r.passed++;
  r.approachingGate = false;
  r.lastProgress = time;
  r.nextGate = (r.nextGate + 1) % track.gates.length;
  if (wasStart) {
    if (r.lap > 0) {
      r.laps.push(time - r.lapStart);
      if (r.lap === totalLaps) {
        r.finished = true;
        r.finishTime = time;
      }
    }
    r.lap++;
    r.lapStart = time;
  }
  return true;
}
/** Autopilot follows the course after finishing without changing race records. */
export function advanceFinishLap(r: Racer, previous: { x: number; z: number }, track: Track) {
  if (r.finished && crossesGate(previous, r, track.gates[r.nextGate])) {
    r.nextGate = (r.nextGate + 1) % track.gates.length;
    r.approachingGate = false;
  }
}
export function raceProgress(r: Racer, track: Track): number {
  const g = track.gates[r.nextGate];
  return r.passed - Math.min(Math.hypot(g.x - r.x, g.z - r.z) / 120, 0.99);
}
/** Ties share a position, matching the number shown in the race HUD. */
export function racePosition(player: Racer, racers: Racer[], track: Track): number {
  return (
    1 +
    racers.filter(
      (r) =>
        r !== player &&
        (r.finished
          ? !player.finished || r.finishTime < player.finishTime
          : !player.finished && raceProgress(r, track) > raceProgress(player, track)),
    ).length
  );
}
export function catchupPower(r: Racer, player: Racer, track: Track): number {
  if (r.id !== 1 && r.id !== 2) return 1;
  return 1 + clamp((raceProgress(player, track) - raceProgress(r, track) - 1) / 8, 0, 0.12);
}
export type Difficulty = 'easy' | 'normal' | 'expert';
export function aiInput(
  r: Racer,
  track: Track,
  racers: Racer[],
  difficulty: Difficulty = 'normal',
): Input {
  const nearest = nearestPoint(track, r),
    speed = Math.hypot(r.vx, r.vz);
  let target = routePoint(track, nearest + Math.max(4, speed * 0.45));
  const gate = track.gates[r.nextGate],
    distance = Math.hypot(gate.x - r.x, gate.z - r.z);
  const gateSide = (r.x - gate.x) * gate.tx + (r.z - gate.z) * gate.tz;
  if (gateSide > 5) r.approachingGate = true;
  if (r.approachingGate) {
    target = { x: gate.x - gate.tx * 40, z: gate.z - gate.tz * 40 };
    if (Math.hypot(target.x - r.x, target.z - r.z) < 8) r.approachingGate = false;
  } else if (distance < 90) target = gate;
  let desired = Math.atan2(target.x - r.x, target.z - r.z),
    avoidance = 0;
  for (const other of racers) {
    if (other === r) continue;
    const dx = other.x - r.x,
      dz = other.z - r.z,
      d = Math.hypot(dx, dz);
    const along = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw);
    if (d < 12 && along > 0) {
      const side = dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw);
      avoidance += (side > 0 ? -0.25 : 0.25) * (1 - d / 12);
    }
  }
  const turn = angle(desired - r.yaw),
    steer = clamp(turn * 2.4 + avoidance, -1, 1);
  const pace = {
    easy: { cruise: 18.45, corner: 14, maxSlowdown: 18, throttle: 0.82 },
    normal: { cruise: 23, corner: 14, maxSlowdown: 18, throttle: 1 },
    expert: { cruise: 26, corner: 10, maxSlowdown: 18, throttle: 1 },
  }[difficulty];
  const targetSpeed = r.approachingGate
    ? 11
    : pace.cruise - Math.min(Math.abs(turn) * pace.corner, pace.maxSlowdown);
  return {
    throttle: clamp((targetSpeed - speed) * 0.4 + 0.65, 0, pace.throttle),
    brake: clamp((speed - targetSpeed - 1) / 12, 0, 0.7),
    steer,
    lean: 0,
  };
}
export function recoverRacer(r: Racer, track: Track, time: number): void {
  r.approachingGate = false;
  const g = track.gates[(r.nextGate - 1 + track.gates.length) % track.gates.length];
  const start = r.passed === 0 ? createRacer(track, r.id) : null;
  r.x = start ? start.x : g.x;
  r.z = start ? start.z : g.z;
  r.y = waterHeight(r.x, r.z, time, track) + 0.6;
  r.yaw = start
    ? start.yaw
    : Math.atan2(track.gates[r.nextGate].x - g.x, track.gates[r.nextGate].z - g.z);
  r.onRamp = false;
  r.wet = 1;
  r.steer = 0;
  r.vx = 0;
  r.vz = 0;
  r.vy = 0;
  r.pitch = 0;
  r.roll = 0;
  r.pitchVelocity = 0;
  r.rollVelocity = 0;
  r.recovered = true;
  r.body = createRiderLoad();
  r.air = createAerialState();
  r.recovery = createRecoveryState();
}
