import { clamp } from './math';
import type { Racer } from './physics';

export interface HandlingForces {
  waveLift: number;
  airLift: number;
  airDrag: number;
  pitchDrive: number;
  pitchDamping: number;
  steering: number;
  braking: number;
  lateralGrip: number;
}

/** Pure handling policy. The physics step owns smoothing and integration. */
export function calculateHandling(
  r: Readonly<
    Pick<Racer, 'lean' | 'steer' | 'wet' | 'onRamp' | 'pitch' | 'pitchVelocity' | 'air' | 'body'>
  >,
  brake: number,
  speed: number,
  slope: number,
  buoyancy: number,
): HandlingForces {
  const trim = r.air.armed ? 0 : r.lean;
  const waterTrim = r.onRamp ? 0 : trim;
  const airborne = r.wet === 0 && !r.onRamp;
  const moving = clamp((speed - 4) / 14, 0, 1);
  // Boost only the rising face's existing launch force, never flat-water lift.
  const waveLift = waterTrim * clamp(slope * 3, 0, 1) * moving * Math.max(0, buoyancy - 9.81) * 0.8;
  // Flight assistance expires, remains weaker than gravity, and costs speed.
  const airControl = airborne ? moving * clamp(1 - r.body.airtime / 1.2, 0, 1) : 0;
  const airLift = trim * (trim > 0 ? 3.8 : 5.5) * airControl;
  // Only firm braking releases the stern. Light braking retains normal grip.
  const drift = r.onRamp
    ? 0
    : clamp((brake - 0.7) / 0.3, 0, 1) * Math.abs(r.steer) * clamp((speed - 5) / 10, 0, 1);
  return {
    waveLift,
    airLift,
    airDrag: Math.max(0, airLift) * 0.035,
    pitchDrive: r.body.fore * (r.air.armed ? 0 : 4.8) + trim * (r.wet > 0 ? 4 : 2.5),
    pitchDamping: r.wet === 0 ? (r.pitch * 7 + r.pitchVelocity * 2) * Math.abs(trim) : 0,
    steering: (1 - brake * 0.2 + drift * 0.95) * (1 - waterTrim * 0.4),
    braking: 1.8 - drift * 1.55,
    lateralGrip: (1 - drift * 0.86) * (1 - waterTrim * 0.2),
  };
}
