import { collideRampWalls } from './ramp-collision';
import { waterHeight } from './water';
import { nearestPoint, routePoint, type Track, type Gate } from './tracks';
export interface Input {
  throttle: number;
  steer: number;
  brake: number;
  lean: number;
}
export interface Racer {
  id: number;
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
    name: ['YOU', 'NOVA', 'ECHO', 'FLUX', 'ONYX', 'SOL'][id],
    color: ['#86fadd', '#ff5b82', '#ffbc57', '#b890ff', '#8dbdf5', '#ffffff'][id],
    x,
    y: waterHeight(x, z, 0, track.wave) + 0.6,
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
): void {
  r.lean += (input.lean - r.lean) * (1 - Math.exp(-dt * 10));
  const previous = { x: r.x, y: r.y, z: r.z };
  const speed = Math.hypot(r.vx, r.vz),
    fx = Math.sin(r.yaw),
    fz = Math.cos(r.yaw),
    rx = fz,
    rz = -fx;
  let force = 0,
    front = 0,
    back = 0,
    left = 0,
    right = 0,
    contacts = 0;
  for (const along of [-1.55, 1.55])
    for (const side of [-0.62, 0.62]) {
      const x = r.x + fx * along + rx * side,
        z = r.z + fz * along + rz * side;
      const localY = r.y + Math.sin(r.pitch) * along + Math.sin(r.roll) * side;
      const h = waterHeight(x, z, t, track.wave),
        waterV = (waterHeight(x, z, t + 0.025, track.wave) - h) / 0.025;
      const immersion = h + 0.48 + Math.min(speed / 120, 0.2) - localY;
      const pointV = r.vy + r.pitchVelocity * along + r.rollVelocity * side;
      const spring = immersion > -0.12 ? clamp(immersion * 48 - (pointV - waterV) * 7.5, 0, 85) : 0;
      if (immersion > -0.12) contacts++;
      force += spring / 4;
      if (along > 0) front += spring;
      else back += spring;
      if (side > 0) right += spring;
      else left += spring;
    }
  r.wet = contacts / 4;
  r.vy += (force - 9.81) * dt;
  r.y += r.vy * dt;
  const targetBank = -input.steer * clamp(speed / 24, 0, 1) * 0.35;
  r.pitchVelocity +=
    ((front - back) * 0.19 - r.pitchVelocity * 3 - r.pitch * 2 + input.lean * 2.8) * dt;
  r.rollVelocity += ((right - left) * 0.25 + (targetBank - r.roll) * 13 - r.rollVelocity * 5) * dt;
  r.pitch = clamp(r.pitch + r.pitchVelocity * dt, -0.8, 0.8);
  r.roll = clamp(r.roll + r.rollVelocity * dt, -0.9, 0.9);
  r.steer += (input.steer - r.steer) * Math.min(1, dt * 7);
  const grip = r.onRamp ? 0.55 : r.wet;
  r.yaw += r.steer * 1.05 * clamp(speed / 9, 0, 1) * (1 - input.brake * 0.2) * grip * dt;
  const forward = r.vx * fx + r.vz * fz,
    lateral = r.vx * rx + r.vz * rz;
  const thrust = input.throttle * 19 * power * grip;
  const drag =
    (0.037 * forward * Math.abs(forward) +
      input.brake * forward * 1.8 +
      (1 - input.throttle) * forward * 0.9) *
    grip;
  const sideDrag = lateral * (2.3 + input.brake) * grip;
  r.vx += (fx * (thrust - drag) - rx * sideDrag) * dt;
  r.vz += (fz * (thrust - drag) - rz * sideDrag) * dt;
  if (!r.onRamp && r.wet > 0) {
    const slopeX =
      (waterHeight(r.x + 1.5, r.z, t, track.wave) - waterHeight(r.x - 1.5, r.z, t, track.wave)) / 3;
    const slopeZ =
      (waterHeight(r.x, r.z + 1.5, t, track.wave) - waterHeight(r.x, r.z - 1.5, t, track.wave)) / 3;
    const waveDrive = clamp(speed / 6, 0, 1);
    r.vx -= slopeX * 4.5 * r.wet * waveDrive * dt;
    r.vz -= slopeZ * 4.5 * r.wet * waveDrive * dt;
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
  r.onRamp = false;
  if (!wallHit && deck && r.y <= deck.height + 0.52) {
    const alongVelocity = r.vx * deck.ramp.tx + r.vz * deck.ramp.tz;
    r.y = deck.height + 0.52;
    r.vy = (alongVelocity * deck.ramp.height) / deck.ramp.length;
    const rampPitch =
      Math.atan(deck.ramp.height / deck.ramp.length) * (fx * deck.ramp.tx + fz * deck.ramp.tz);
    r.pitch += (rampPitch - r.pitch) * (1 - Math.exp(-dt * 14));
    r.pitchVelocity = 0;
    r.roll *= Math.exp(-dt * 12);
    r.onRamp = true;
    r.wet = 0;
  }
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
}
export function collideRacers(a: Racer, b: Racer): boolean {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    d = Math.hypot(dx, dz);
  if (d >= 2.7 || Math.abs(a.y - b.y) > 2) return false;
  const nx = d < 0.0001 ? 1 : dx / d,
    nz = d < 0.0001 ? 0 : dz / d,
    overlap = (2.7 - d) * 0.5;
  a.x -= nx * overlap;
  a.z -= nz * overlap;
  b.x += nx * overlap;
  b.z += nz * overlap;
  const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (closing < 0) {
    const impulse = -closing * 0.58;
    a.vx -= impulse * nx;
    a.vz -= impulse * nz;
    b.vx += impulse * nx;
    b.vz += impulse * nz;
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
  if (r.finished || !crossesGate(previous, r, track.gates[r.nextGate])) return false;
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
export function raceProgress(r: Racer, track: Track): number {
  const g = track.gates[r.nextGate];
  return r.passed - Math.min(Math.hypot(g.x - r.x, g.z - r.z) / 120, 0.99);
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
  const cruiseSpeed =
    (track.wave > 2 ? 20 : 22.5) * { easy: 0.82, normal: 0.94, expert: 1.03 }[difficulty];
  const targetSpeed = r.approachingGate ? 11 : cruiseSpeed - Math.min(Math.abs(turn) * 10, 16);
  return {
    throttle: clamp(
      (targetSpeed - speed) * 0.4 + 0.65,
      0,
      difficulty === 'expert' ? 1 : difficulty === 'easy' ? 0.82 : 0.88 + 0.015 * r.id,
    ),
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
  r.y = waterHeight(r.x, r.z, time, track.wave) + 0.6;
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
}
