import type { Input, Racer } from './physics';
import { beginRecovery } from './recovery';

export interface AerialState {
  trick: 'none' | 'flip' | 'spin';
  progress: number;
  direction: number;
  pitch: number;
  yaw: number;
  held: boolean;
  charge: number;
  selected: number;
  queued: number;
  buffer: number;
  pending: string;
  message: string;
  messageTime: number;
}
export function createAerialState(): AerialState {
  return {
    trick: 'none',
    progress: 0,
    direction: 1,
    pitch: 0,
    yaw: 0,
    held: false,
    charge: 0,
    selected: 0,
    queued: 0,
    buffer: 0,
    pending: '',
    message: '',
    messageTime: 0,
  };
}
/** Clear only takeoff intent; pausing must not release a queued trick. */
export function cancelTrickSetup(r: Racer): void {
  Object.assign(r.air, { held: false, charge: 0, selected: 0, queued: 0, buffer: 0 });
}
/** Load while supported, then release within 300 ms of takeoff. */
export function stepAerial(r: Racer, input: Input, clearance: number, dt: number): void {
  const air = r.air,
    request = input.trick ?? 0;
  air.messageTime = Math.max(0, air.messageTime - dt);
  air.buffer = Math.max(0, air.buffer - dt);
  if (!air.buffer) air.queued = 0;
  const eligible =
    r.recovery.phase === 'riding' && !r.finished && air.trick === 'none' && !air.pending;
  if (!eligible) cancelTrickSetup(r);
  else {
    if (request) {
      if (r.wet > 0 || r.onRamp || air.charge > 0) {
        air.charge = Math.min(1, air.charge + dt);
        air.selected = request;
      }
    } else if (air.held) {
      if (air.charge >= 0.12) {
        air.queued = air.selected;
        air.buffer = 0.3;
      }
      air.charge = 0;
      air.selected = 0;
    }
    air.held = request !== 0;
    if (
      air.queued &&
      r.body.airtime > 0.025 &&
      r.body.airtime < 0.4 &&
      clearance > 0.65 &&
      !r.onRamp &&
      r.wet === 0
    ) {
      const selected = air.queued;
      air.trick = Math.abs(selected) === 1 ? 'flip' : 'spin';
      air.direction = selected < 0 ? -1 : 1;
      air.progress = 0;
      cancelTrickSetup(r);
    }
    if (r.body.airtime >= 0.4) cancelTrickSetup(r);
  }
  if (air.trick === 'none') return;
  air.progress = Math.min(1, air.progress + dt / (air.trick === 'flip' ? 1.25 : 1.05));
  const eased = air.progress * air.progress * (3 - 2 * air.progress);
  const rotation = eased * Math.PI * 2 * air.direction;
  air.pitch = air.trick === 'flip' ? rotation : 0;
  air.yaw = air.trick === 'spin' ? rotation : 0;
  if (air.progress === 1) {
    air.pending = air.trick === 'flip' ? 'FLIP LANDED' : 'SPIN LANDED';
    air.trick = 'none';
    air.pitch = 0;
    air.yaw = 0;
  }
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
  const trick = air.trick;
  const rotation = Math.max(Math.abs(air.pitch), Math.abs(air.yaw));
  const wrap = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
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
    if (trick !== 'none') {
      const speed = Math.hypot(r.vx, r.vz);
      const sideways = speed > 0.1 ? Math.abs((r.vx * fz - r.vz * fx) / speed) : 0;
      const scrub = Math.min(
        0.18,
        ((1 - Math.cos(tilt)) * 0.25 + sideways * 0.05) * Math.min(1.5, Math.max(0.25, impact / 8)),
      );
      r.vx *= 1 - scrub;
      r.vz *= 1 - scrub;
    }
    if (air.pending === 'FLIP LANDED' && !r.finished && r.recovery.phase === 'riding') {
      const speed = Math.hypot(r.vx, r.vz);
      // A small landing reward follows existing momentum; it cannot turn or launch the ski.
      if (speed > 1) {
        const gain = Math.min(speed * 0.1, 2);
        r.vx *= (speed + gain) / speed;
        r.vz *= (speed + gain) / speed;
      }
    }
    air.message =
      air.pending || (rotation > Math.PI ? `${trick === 'flip' ? 'FLIP' : 'SPIN'} LANDED` : '');
    air.messageTime = air.message ? 1.8 : 0;
  }
  air.trick = 'none';
  air.pitch = 0;
  air.yaw = 0;
  air.pending = '';
}
