import type { Racer } from './physics';
import type { Track } from './tracks';
/** Swept hull-width tests against the wedge's side and rear faces. The low nose stays open. */
export function collideRampWalls(
  r: Racer,
  previous: { x: number; y: number; z: number },
  track: Track,
): boolean {
  let hit = false;
  for (const ramp of track.ramps) {
    const local = (p: { x: number; z: number }) => ({
      along: (p.x - ramp.x) * ramp.tx + (p.z - ramp.z) * ramp.tz,
      side: -(p.x - ramp.x) * ramp.tz + (p.z - ramp.z) * ramp.tx,
    });
    const a = local(previous),
      b = local(r),
      halfWidth = ramp.width / 2 + 0.55,
      halfLength = ramp.length / 2;
    const walls = [
      { axis: 'side' as const, boundary: -halfWidth, normal: -1 },
      { axis: 'side' as const, boundary: halfWidth, normal: 1 },
      { axis: 'along' as const, boundary: halfLength + 0.55, normal: 1 },
    ];
    for (const wall of walls) {
      const before = (a[wall.axis] - wall.boundary) * wall.normal,
        after = (b[wall.axis] - wall.boundary) * wall.normal;
      if (before < 0 || after >= 0) continue;
      const fraction = before / (before - after),
        along = a.along + (b.along - a.along) * fraction,
        side = a.side + (b.side - a.side) * fraction;
      if (
        wall.axis === 'side'
          ? along < -halfLength || along > halfLength
          : Math.abs(side) > halfWidth
      )
        continue;
      const top =
        ramp.baseHeight +
        (Math.max(-halfLength, Math.min(halfLength, along)) / ramp.length + 0.5) * ramp.height;
      const keel = previous.y + (r.y - previous.y) * fraction - 0.42;
      if (keel >= top - 0.03) continue;
      const nx = wall.axis === 'side' ? -ramp.tz * wall.normal : ramp.tx,
        nz = wall.axis === 'side' ? ramp.tx * wall.normal : ramp.tz;
      r.x = previous.x + (r.x - previous.x) * fraction + nx * 0.015;
      r.z = previous.z + (r.z - previous.z) * fraction + nz * 0.015;
      const velocity = r.vx * nx + r.vz * nz;
      if (velocity < 0) {
        r.vx -= velocity * 1.18 * nx;
        r.vz -= velocity * 1.18 * nz;
      }
      hit = true;
      break;
    }
  }
  return hit;
}
