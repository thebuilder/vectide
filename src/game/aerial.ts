import type { Input, Racer } from './physics';
import { beginRecovery } from './recovery';

export interface AerialState {
  armed: boolean;
  dive: number;
  pitch: number;
  yaw: number;
  pitchVelocity: number;
  yawVelocity: number;
  held: boolean;
  charge: number;
  queued: boolean;
  buffer: number;
  message: string;
  messageTime: number;
}
export function createAerialState(): AerialState {
  return {
    armed: false,
    dive: 0,
    pitch: 0,
    yaw: 0,
    pitchVelocity: 0,
    yawVelocity: 0,
    held: false,
    charge: 0,
    queued: false,
    buffer: 0,
    message: '',
    messageTime: 0,
  };
}
const wrap = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
const TAU = Math.PI * 2;
/** Clear only takeoff intent; pausing must not release a queued stunt. */
export function cancelTrickSetup(r: Racer): void {
  Object.assign(r.air, { held: false, charge: 0, queued: false, buffer: 0 });
}
/** Input accelerates rotation; centering settles only within 25 degrees of alignment. */
function turnVelocity(velocity: number, input: number, rotation: number, dt: number): number {
  if (Math.abs(input) > 0.12) {
    const target = input * 6.8;
    // Bounded torque carries the current spin through counter-input before reversing.
    const acceleration = 22 * Math.abs(input) * dt;
    return velocity + Math.max(-acceleration, Math.min(acceleration, target - velocity));
  }
  const error = wrap(rotation);
  if (Math.abs(error) < 0.44) return velocity + (-error * 70 - velocity * 17) * dt;
  return velocity * Math.exp(-dt * 8);
}
/** Load while supported, release near takeoff, then control the whole flight. */
export function stepAerial(r: Racer, input: Input, clearance: number, dt: number): void {
  const air = r.air,
    request = !!input.trick;
  air.messageTime = Math.max(0, air.messageTime - dt);
  air.buffer = Math.max(0, air.buffer - dt);
  if (!air.buffer) air.queued = false;
  const eligible = r.recovery.phase === 'riding' && !r.finished && !air.armed;
  if (!eligible) cancelTrickSetup(r);
  else {
    if (request && (r.wet > 0 || r.onRamp || air.charge > 0))
      air.charge = Math.min(1, air.charge + dt);
    else if (!request && air.held) {
      if (air.charge >= 0.12) {
        air.queued = true;
        air.buffer = 0.3;
      }
      air.charge = 0;
    }
    air.held = request;
    if (
      air.queued &&
      r.body.airtime > 0.025 &&
      r.body.airtime < 0.4 &&
      clearance > 0.65 &&
      !r.onRamp &&
      r.wet === 0
    ) {
      air.armed = true;
      cancelTrickSetup(r);
    }
    if (r.body.airtime >= 0.4) cancelTrickSetup(r);
  }
  if (!air.armed || r.wet > 0 || r.onRamp || r.recovery.phase !== 'riding') return;
  // Normalize diagonal input so a stick and digital keys share the same rotation budget.
  const magnitude = Math.max(1, Math.hypot(input.lean, input.steer));
  air.pitchVelocity = turnVelocity(
    air.pitchVelocity,
    input.lean / magnitude,
    air.pitch + r.pitch,
    dt,
  );
  air.yawVelocity = turnVelocity(air.yawVelocity, input.steer / magnitude, air.yaw, dt);
  air.pitch += air.pitchVelocity * dt;
  air.yaw += air.yawVelocity * dt;
}
function rotationLabel(turns: number, name: string): string {
  return `${turns === 1 ? '' : turns === 2 ? 'DOUBLE ' : turns === 3 ? 'TRIPLE ' : `${turns} `}${name}`;
}
export interface LandingSurface {
  slopeX: number;
  slopeZ: number;
  velocity: number;
}

export function landAerial(
  r: Racer,
  entryVelocity: number,
  surface: LandingSurface = { slopeX: 0, slopeZ: 0, velocity: 0 },
): void {
  const air = r.air;
  const armed = air.armed;
  const flips = Math.floor((Math.abs(air.pitch) + 0.06) / TAU);
  const spins = Math.floor((Math.abs(air.yaw) + 0.06) / TAU);
  const rotation = Math.max(Math.abs(air.pitch), Math.abs(air.yaw));
  // The visible landing orientation becomes the physical hull orientation, even for
  // unfinished tricks. Preserve world momentum so an angled spin skids into its new heading.
  r.pitch = wrap(r.pitch + air.pitch);
  r.yaw = wrap(r.yaw + air.yaw);
  const fx = Math.sin(r.yaw),
    fz = Math.cos(r.yaw);
  const pitchError = wrap(r.pitch - Math.atan(surface.slopeX * fx + surface.slopeZ * fz));
  const rollError = wrap(r.roll - Math.atan(surface.slopeX * fz - surface.slopeZ * fx));
  const tilt = Math.acos(Math.max(-1, Math.min(1, Math.cos(pitchError) * Math.cos(rollError))));
  const impact = Math.max(
    0,
    (surface.velocity + r.vx * surface.slopeX + r.vz * surface.slopeZ - entryVelocity) /
      Math.hypot(1, surface.slopeX, surface.slopeZ),
  );
  const unsafe = tilt > Math.PI / 2 || (tilt > 1.15 && impact > 7) || (tilt > 0.9 && impact > 16);
  if (unsafe) beginRecovery(r);
  else {
    if (armed) {
      const speed = Math.hypot(r.vx, r.vz);
      const sideways = speed > 0.1 ? Math.abs((r.vx * fz - r.vz * fx) / speed) : 0;
      const scrub = Math.min(
        0.18,
        ((1 - Math.cos(tilt)) * 0.25 + sideways * 0.05) * Math.min(1.5, Math.max(0.25, impact / 8)),
      );
      r.vx *= 1 - scrub;
      r.vz *= 1 - scrub;
    }
    if (flips > 0 && !r.finished && r.recovery.phase === 'riding') {
      const speed = Math.hypot(r.vx, r.vz);
      // A small landing reward follows existing momentum; it cannot turn or launch the ski.
      if (speed > 1) {
        const gain = Math.min(speed * 0.1, 2);
        r.vx *= (speed + gain) / speed;
        r.vz *= (speed + gain) / speed;
      }
    }
    const labels = [
      flips ? rotationLabel(flips, 'FLIP') : '',
      spins ? rotationLabel(spins, 'SPIN') : '',
    ].filter(Boolean);
    air.message = labels.length
      ? `${labels.join(' + ')} LANDED`
      : rotation > Math.PI
        ? 'STUNT LANDED'
        : '';
    air.messageTime = air.message ? 1.8 : 0;
  }
  air.armed = false;
  air.pitch = 0;
  air.yaw = 0;
  air.pitchVelocity = 0;
  air.yawVelocity = 0;
  cancelTrickSetup(r);
}
