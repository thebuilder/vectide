import type { Racer } from './physics';
import type { Point } from './tracks';
// Horizontal hull outline, matching the loft stations in jets.ts.
const HULL = [
  [-0.58, -1.9],
  [-0.73, -1.55],
  [-0.79, -0.55],
  [-0.64, 0.65],
  [-0.4, 1.5],
  [-0.035, 2.13],
  [0.035, 2.13],
  [0.4, 1.5],
  [0.64, 0.65],
  [0.79, -0.55],
  [0.73, -1.55],
  [0.58, -1.9],
];
export function hullPoints(r: Racer) {
  const c = Math.cos(r.yaw),
    s = Math.sin(r.yaw);
  return HULL.map(([x, z]) => ({
    x: r.x + x * 0.82 * c + z * 0.87 * s,
    z: r.z - x * 0.82 * s + z * 0.87 * c,
  }));
}

/** Separating-axis contact, with the normal pointing from the first convex polygon to the second. */
export function polygonContact(
  ah: readonly Point[],
  bh: readonly Point[],
): { x: number; z: number; depth: number } | null {
  let depth = Infinity,
    nx = 0,
    nz = 0;
  for (const hull of [ah, bh])
    for (let i = 0; i < hull.length; i++) {
      const p = hull[i],
        q = hull[(i + 1) % hull.length],
        length = Math.hypot(q.x - p.x, q.z - p.z);
      let x = -(q.z - p.z) / length,
        z = (q.x - p.x) / length;
      let amin = Infinity,
        amax = -Infinity,
        bmin = Infinity,
        bmax = -Infinity;
      for (const v of ah) {
        const d = v.x * x + v.z * z;
        amin = Math.min(amin, d);
        amax = Math.max(amax, d);
      }
      for (const v of bh) {
        const d = v.x * x + v.z * z;
        bmin = Math.min(bmin, d);
        bmax = Math.max(bmax, d);
      }
      const forward = amax - bmin,
        backward = bmax - amin;
      if (forward <= 0 || backward <= 0) return null;
      const overlap = Math.min(forward, backward);
      if (backward < forward) {
        x = -x;
        z = -z;
      }
      if (overlap < depth) {
        depth = overlap;
        nx = x;
        nz = z;
      }
    }
  return { x: nx, z: nz, depth };
}
