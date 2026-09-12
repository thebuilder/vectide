import type { Point, Track } from './tracks';

export const TORPEDO_DEPTH = -0.35;
const RADIUS = 0.35;

/** First swept contact, including an initial overlap. */
export function segmentCircleHit(
  from: Point,
  to: Point,
  center: Point,
  radius: number,
): number | null {
  const x = from.x - center.x,
    z = from.z - center.z;
  const c = x * x + z * z - radius * radius;
  if (c <= 0) return 0;
  const dx = to.x - from.x,
    dz = to.z - from.z,
    a = dx * dx + dz * dz;
  if (a === 0) return null;
  const b = x * dx + z * dz,
    discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

/** Precompute solid scenery at torpedo depth; the collider is shared by both torpedo variants. */
export function createTorpedoCollider(track: Track) {
  const outlines = track.land.map((land) => {
    // The shallow submerged beach lies between the dry bank and the outer shore ring.
    const scale = land.kind === 'dock' ? 1 : 1.035;
    return land.outline.map((p) => ({
      x: land.x + (p.x - land.x) * scale,
      z: land.z + (p.z - land.z) * scale,
    }));
  });
  for (const ramp of track.ramps) {
    if (
      ramp.baseHeight > TORPEDO_DEPTH + RADIUS ||
      ramp.baseHeight + ramp.height < TORPEDO_DEPTH - RADIUS
    )
      continue;
    const nose = Math.max(
      -ramp.length / 2,
      ((TORPEDO_DEPTH - RADIUS - ramp.baseHeight) / ramp.height - 0.5) * ramp.length,
    );
    outlines.push(
      [
        [nose, -ramp.width / 2],
        [ramp.length / 2, -ramp.width / 2],
        [ramp.length / 2, ramp.width / 2],
        [nose, ramp.width / 2],
      ].map(([along, side]) => ({
        x: ramp.x + ramp.tx * along - ramp.tz * side,
        z: ramp.z + ramp.tz * along + ramp.tx * side,
      })),
    );
  }
  const polygons = outlines.map((points) => {
    const area = points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.z - q.x * p.z;
    }, 0);
    const winding = area >= 0 ? 1 : -1;
    return points.map((p, i) => {
      const q = points[(i + 1) % points.length],
        dx = q.x - p.x,
        dz = q.z - p.z,
        length = Math.hypot(dx, dz);
      const x = (-dz / length) * winding,
        z = (dx / length) * winding;
      return { x, z, offset: x * p.x + z * p.z - RADIUS };
    });
  });
  return (from: Point, to: Point): number | null => {
    let first = Infinity;
    for (const planes of polygons) {
      let enter = 0,
        exit = 1;
      for (const plane of planes) {
        const a = plane.x * from.x + plane.z * from.z - plane.offset;
        const b = plane.x * to.x + plane.z * to.z - plane.offset;
        if (a < 0 && b < 0) {
          enter = Infinity;
          break;
        }
        if (a < 0) enter = Math.max(enter, a / (a - b));
        else if (b < 0) exit = Math.min(exit, a / (a - b));
        if (enter > exit) break;
      }
      if (enter <= exit) first = Math.min(first, enter);
    }
    for (const obstacle of track.obstacles) {
      const hit = segmentCircleHit(from, to, obstacle, obstacle.radius + RADIUS);
      if (hit !== null) first = Math.min(first, hit);
    }
    return first === Infinity ? null : first;
  };
}
