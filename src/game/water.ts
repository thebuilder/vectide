import { pulseHeight, type WaterPulse } from './water-pulses';
import { coastalHeight, shoreDistance, type ShoreField } from './shore';
// Fixed world-space grid. Physics interpolates the same two triangles as the GPU mesh.
export const CELL = 4;
export const WAVES = [
  { x: 0.92, z: 0.39, k: 0.105, s: 1.28, a: 0.72 },
  { x: -0.34, z: 0.94, k: 0.19, s: 1.74, a: 0.32 },
  { x: 0.71, z: -0.71, k: 0.36, s: 2.35, a: 0.13 },
];
export interface WaveZone {
  name: string;
  x: number;
  z: number;
  tx: number;
  tz: number;
  length: number;
  width: number;
  /** Fraction of background swell blocked here, from zero to one. */
  shelter: number;
  /** Added swell amplitude, relative to the course's wave strength. */
  swell: number;
  wavelength: number;
  speed: number;
}
export interface WaterProfile {
  wave: number;
  shore?: ShoreField;
  waveZones?: readonly WaveZone[];
  pulses?: readonly WaterPulse[];
  pulseTime?: number;
}
type Surface = number | WaterProfile;
export function waveZoneWeight(x: number, z: number, zone: WaveZone): number {
  const dx = x - zone.x,
    dz = z - zone.z;
  const along = (dx * zone.tx + dz * zone.tz) / (zone.length / 2);
  const side = (-dx * zone.tz + dz * zone.tx) / (zone.width / 2);
  const blend = Math.max(0, Math.min(1, (Math.hypot(along, side) - 0.5) * 2));
  return 1 - blend * blend * (3 - 2 * blend);
}
export function vertexHeight(x: number, z: number, t: number, surface: Surface): number {
  const amplitude = typeof surface === 'number' ? surface : surface.wave;
  let h = 0;
  for (const w of WAVES) h += Math.sin((x * w.x + z * w.z) * w.k - t * w.s) * w.a;
  let shelter = 1,
    swell = 0;
  if (typeof surface !== 'number')
    for (const zone of surface.waveZones ?? []) {
      const weight = waveZoneWeight(x, z, zone);
      if (weight === 0) continue;
      shelter *= 1 - weight * zone.shelter;
      const phase =
        ((x - zone.x) * zone.tx + (z - zone.z) * zone.tz - t * zone.speed) *
        ((2 * Math.PI) / zone.wavelength);
      // A second harmonic gives a firm launch face and a longer back to each crest.
      swell += (Math.sin(phase) + 0.25 * Math.sin(2 * phase)) * zone.swell * weight;
    }
  let disturbance = 0;
  if (typeof surface !== 'number')
    for (const pulse of surface.pulses ?? [])
      disturbance += pulseHeight(x, z, pulse.age + t - (surface.pulseTime ?? t), pulse);
  const height = (h * shelter + swell) * amplitude + Math.max(-2, Math.min(5, disturbance));
  return typeof surface === 'number'
    ? height
    : coastalHeight(height, shoreDistance(x, z, surface.shore), t, amplitude);
}
export function waterHeight(x: number, z: number, t: number, surface: Surface): number {
  const gx = Math.floor(x / CELL) * CELL,
    gz = Math.floor(z / CELL) * CELL;
  const u = (x - gx) / CELL,
    v = (z - gz) / CELL;
  const a = vertexHeight(gx, gz, t, surface),
    b = vertexHeight(gx + CELL, gz, t, surface);
  const c = vertexHeight(gx, gz + CELL, t, surface),
    d = vertexHeight(gx + CELL, gz + CELL, t, surface);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
const gl = (n: number) => n.toFixed(8);
const baseWaves = WAVES.map(
  (w) => `sin(dot(p,vec2(${gl(w.x)},${gl(w.z)}))*${gl(w.k)}-uTime*${gl(w.s)})*${gl(w.a)}`,
).join('+');
/** Generated from the same zone data as CPU sampling; no independent shader tuning. */
export function waterGLSL(profile: WaterProfile): string {
  const zones = (profile.waveZones ?? [])
    .map(
      (zone) => `{
    vec2 offset=p-vec2(${gl(zone.x)},${gl(zone.z)});
    vec2 direction=vec2(${gl(zone.tx)},${gl(zone.tz)});
    vec2 local=vec2(dot(offset,direction)/${gl(zone.length / 2)},dot(offset,vec2(-direction.y,direction.x))/${gl(zone.width / 2)});
    float weight=1.-smoothstep(.5,1.,length(local));
    shelter*=1.-weight*${gl(zone.shelter)};
    float phase=(dot(offset,direction)-uTime*${gl(zone.speed)})*${gl((2 * Math.PI) / zone.wavelength)};
    swell+=(sin(phase)+.25*sin(phase*2.))*${gl(zone.swell)}*weight;
  }`,
    )
    .join('\n');
  return `float heightAt(vec2 p) { float shelter=1.; float swell=0.; ${zones} return (${baseWaves})*shelter+swell; }`;
}
