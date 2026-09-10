import { TRACKS, type Track } from '../game/tracks';
import type { Racer } from '../game/physics';

/** A separate waiting lagoon, independent of the host's selected race course. */
export const PRACTICE: Track = {
  ...TRACKS[0],
  id: 'practice',
  name: 'FREE RIDE',
  practiceRadius: 110,
  wave: 0.8,
  waveZones: [],
  land: [],
  obstacles: [],
  gates: [
    { x: 0, z: -45, tx: 0, tz: 1, width: 32 },
    { x: 0, z: 45, tx: 0, tz: 1, width: 32 },
  ],
  points: Array.from({ length: 96 }, (_, i) => ({
    x: Math.sin((i * Math.PI) / 48) * 90,
    z: Math.cos((i * Math.PI) / 48) * 90,
  })),
  ramps: [
    { x: -24, z: -2, tx: 0, tz: 1, width: 12, length: 28, baseHeight: -4.2, height: 7 },
    { x: 28, z: 25, tx: 0, tz: -1, width: 14, length: 36, baseHeight: -4.2, height: 9 },
  ],
  length: 2 * Math.PI * 90,
};

/** Keep riders inside the visible floating barrier, including during jumps. */
export function containPractice(racer: Racer, radius: number) {
  const distance = Math.hypot(racer.x, racer.z);
  if (distance <= radius - 2) return;
  const x = racer.x / distance,
    z = racer.z / distance;
  racer.x = x * (radius - 2);
  racer.z = z * (radius - 2);
  const outward = Math.max(0, racer.vx * x + racer.vz * z);
  racer.vx -= x * outward * 1.35;
  racer.vz -= z * outward * 1.35;
}
