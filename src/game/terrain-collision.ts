import type { Racer } from './physics';
import type { Track } from './tracks';
import { hullPoints, polygonContact } from './hull-contact';
/** The same convex shore outline is used by terrain rendering and hull collision. */
export function collideTerrain(r: Racer, track: Track): void {
  for (const land of track.land) {
    if (r.y - 0.4 > land.height) continue;
    const radius = Math.max(...land.outline.map((p) => Math.hypot(p.x - land.x, p.z - land.z)));
    if (Math.hypot(r.x - land.x, r.z - land.z) > radius + 2.3) continue;
    const contact = polygonContact(hullPoints(r), land.outline);
    if (!contact) continue;
    r.x -= contact.x * (contact.depth + 0.005);
    r.z -= contact.z * (contact.depth + 0.005);
    const into = r.vx * contact.x + r.vz * contact.z;
    if (into > 0) {
      r.vx -= into * 1.25 * contact.x;
      r.vz -= into * 1.25 * contact.z;
      r.body.impact = Math.max(r.body.impact, Math.min(12, into * 0.5));
    }
  }
}
