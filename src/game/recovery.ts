import type { Racer } from './physics';
import { waterHeight, type WaterProfile } from './water';

export interface RecoveryState {
  phase: 'riding' | 'falling' | 'swimming' | 'remounting';
  elapsed: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  side: number;
  crashes: number;
}
export function createRecoveryState(): RecoveryState {
  return {
    phase: 'riding',
    elapsed: 0,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    side: 1,
    crashes: 0,
  };
}
export function beginRecovery(r: Racer): void {
  const state = r.recovery;
  if (state.phase !== 'riding' || r.finished) return;
  const side = r.body.side < 0 ? -1 : 1,
    rx = Math.cos(r.yaw) * side,
    rz = -Math.sin(r.yaw) * side;
  Object.assign(state, {
    phase: 'falling',
    elapsed: 0,
    x: r.x + rx * 0.25,
    y: r.y,
    z: r.z + rz * 0.25,
    vx: r.vx * 0.18 + rx * 2,
    vy: 2.5,
    vz: r.vz * 0.18 + rz * 2,
    heading: r.yaw,
    side,
    crashes: state.crashes + 1,
  });
  r.vx *= 0.22;
  r.vz *= 0.22;
  r.vy = Math.max(-4, r.vy);
  r.body.foot = 0;
  r.air.message = 'RIDER DOWN';
  r.air.messageTime = 0;
}
/** Recovery stays beside the physical craft. It never edits checkpoint or lap state. */
export function stepRecovery(r: Racer, track: WaterProfile, time: number, dt: number): void {
  const state = r.recovery;
  if (state.phase === 'riding') return;
  state.elapsed += dt;
  r.vx *= Math.exp(-dt * 1.8);
  r.vz *= Math.exp(-dt * 1.8);
  const targetX = r.x + Math.cos(r.yaw) * state.side * 1.05;
  const targetZ = r.z - Math.sin(r.yaw) * state.side * 1.05;
  if (state.phase === 'falling') {
    state.vy -= 9.81 * dt;
    state.x += state.vx * dt;
    state.z += state.vz * dt;
    state.y += state.vy * dt;
    const surface = waterHeight(state.x, state.z, time, track) - 0.25;
    if (state.y <= surface && state.vy < 0) {
      state.phase = 'swimming';
      state.elapsed = 0;
      state.y = surface;
    }
  } else {
    const dx = targetX - state.x,
      dz = targetZ - state.z,
      d = Math.hypot(dx, dz),
      travel = Math.min(d, 3.5 * dt);
    if (d > 0) {
      state.x += (dx / d) * travel;
      state.z += (dz / d) * travel;
    }
    state.y = waterHeight(state.x, state.z, time, track) - 0.25;
    if (state.phase === 'swimming' && state.elapsed > 0.55 && d < 0.3) {
      state.phase = 'remounting';
      state.elapsed = 0;
    } else if (state.phase === 'remounting' && state.elapsed >= 1.35) {
      state.phase = 'riding';
      state.elapsed = 0;
      r.pitchVelocity = 0;
      r.rollVelocity = 0;
      r.air.message = 'BACK ON';
      r.air.messageTime = 1.1;
    }
  }
}
