import { angle, type Racer } from './physics';

export const PHYSICS_STEP = 1 / 120;

function copy(to: Racer, from: Racer) {
  const { body, air, recovery } = to;
  Object.assign(body, from.body);
  Object.assign(air, from.air);
  Object.assign(recovery, from.recovery);
  Object.assign(to, from, { body, air, recovery });
}
function clone(r: Racer): Racer {
  return { ...r, body: { ...r.body }, air: { ...r.air }, recovery: { ...r.recovery } };
}

/** Draw between completed physics steps without changing authoritative race state. */
export class RacerPresentation {
  private poses = new WeakMap<Racer, { previous: Racer; rendered: Racer }>();
  ready = false;

  capture(racers: Racer[]) {
    for (const r of racers) {
      const pose = this.poses.get(r);
      if (pose) copy(pose.previous, r);
      else this.poses.set(r, { previous: clone(r), rendered: clone(r) });
    }
    this.ready = true;
  }

  render(r: Racer, alpha: number): Racer {
    const pose = this.poses.get(r);
    if (!pose) return r;
    const { previous: a, rendered: out } = pose;
    // Resets and crash/remount transitions must never sweep the rider through the course.
    if (
      r.recovered !== a.recovered ||
      r.recovery.phase !== a.recovery.phase ||
      Math.hypot(r.x - a.x, r.y - a.y, r.z - a.z) > 8
    )
      return r;
    copy(out, r);
    const t = Math.max(0, Math.min(1, alpha));
    for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'steer', 'lean'] as const)
      out[key] = a[key] + (r[key] - a[key]) * t;
    for (const key of ['yaw', 'pitch', 'roll'] as const)
      out[key] = a[key] + angle(r[key] - a[key]) * t;
    for (const key of ['side', 'fore', 'compression', 'foot', 'impact', 'airtime'] as const)
      out.body[key] = a.body[key] + (r.body[key] - a.body[key]) * t;
    for (const key of ['pitch', 'yaw'] as const)
      out.air[key] = a.air[key] + angle(r.air[key] - a.air[key]) * t;
    for (const key of ['x', 'y', 'z', 'elapsed'] as const)
      out.recovery[key] = a.recovery[key] + (r.recovery[key] - a.recovery[key]) * t;
    return out;
  }

  clear() {
    this.poses = new WeakMap();
    this.ready = false;
  }
}
