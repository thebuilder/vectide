import type { Landform } from './course-layout';

export interface ShoreField {
  x: number;
  z: number;
  width: number;
  height: number;
  spacing: number;
  distance: Float32Array;
}
const SPACING = 4,
  REACH = 32;
/** Signed distance to the authored collision polygons, cached once on the water vertex grid. */
export function createShoreField(land: readonly Landform[]): ShoreField | undefined {
  if (!land.length) return;
  const points = land.flatMap((l) => l.outline);
  const x = Math.floor((Math.min(...points.map((p) => p.x)) - REACH) / SPACING) * SPACING;
  const z = Math.floor((Math.min(...points.map((p) => p.z)) - REACH) / SPACING) * SPACING;
  const width = Math.ceil((Math.max(...points.map((p) => p.x)) + REACH - x) / SPACING) + 1;
  const height = Math.ceil((Math.max(...points.map((p) => p.z)) + REACH - z) / SPACING) + 1;
  const distance = new Float32Array(width * height);
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      const px = x + col * SPACING,
        pz = z + row * SPACING;
      let nearest = REACH;
      for (const l of land) {
        let inside = true,
          edge = Infinity;
        for (let i = 0; i < l.outline.length; i++) {
          const a = l.outline[i],
            b = l.outline[(i + 1) % l.outline.length];
          const dx = b.x - a.x,
            dz = b.z - a.z;
          const along = Math.max(
            0,
            Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz)),
          );
          edge = Math.min(edge, Math.hypot(px - a.x - dx * along, pz - a.z - dz * along));
          if (dx * (pz - a.z) - dz * (px - a.x) < 0) inside = false;
        }
        nearest = Math.min(nearest, inside ? -edge : edge);
      }
      distance[row * width + col] = nearest;
    }
  return { x, z, width, height, spacing: SPACING, distance };
}
export function shoreDistance(x: number, z: number, field?: ShoreField): number {
  if (!field) return REACH;
  const u = (x - field.x) / field.spacing,
    v = (z - field.z) / field.spacing;
  if (u < 0 || v < 0 || u > field.width - 1 || v > field.height - 1) return REACH;
  const col = Math.min(field.width - 2, Math.floor(u)),
    row = Math.min(field.height - 2, Math.floor(v));
  const fx = u - col,
    fz = v - row,
    index = row * field.width + col,
    d = field.distance;
  return (
    (d[index] * (1 - fx) + d[index + 1] * fx) * (1 - fz) +
    (d[index + field.width] * (1 - fx) + d[index + field.width + 1] * fx) * fz
  );
}
const smooth = (a: number, b: number, n: number) => {
  const t = Math.max(0, Math.min(1, (n - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Breakers travel landward and lose height before the dry bank. Applies to weapon waves too. */
export function coastalHeight(
  height: number,
  distance: number,
  time: number,
  amplitude = 1,
): number {
  if (distance >= 24) return height;
  const phase = distance * 0.52 + time * 2.1;
  const breaker =
    (Math.sin(phase) + 0.22 * Math.sin(phase * 2)) *
    0.28 *
    Math.min(1, amplitude) *
    smooth(0, 3, distance) *
    (1 - smooth(10, 20, distance));
  const water = height * smooth(0, 24, distance) + breaker;
  return Math.min(water, 0.08 + Math.max(0, distance) * 0.12);
}
export const shoreGLSL = `
  uniform sampler2D uShore;
  uniform vec4 uShoreBounds;
  float shoreDistanceAt(vec2 p) {
    vec2 cell=(p-uShoreBounds.xy)/${SPACING}.;
    vec2 size=uShoreBounds.zw;
    if(any(lessThan(cell,vec2(0.)))||any(greaterThan(cell,size-1.))) return ${REACH}.;
    vec2 base=min(floor(cell),size-2.), f=cell-base;
    vec2 uv=(base+.5)/size, step=1./size;
    return mix(mix(texture2D(uShore,uv).r,texture2D(uShore,uv+vec2(step.x,0.)).r,f.x),mix(texture2D(uShore,uv+vec2(0.,step.y)).r,texture2D(uShore,uv+step).r,f.x),f.y);
  }
  float coastalHeight(float height,float distance) {
    if(distance>=24.) return height;
    float phase=distance*.52+uTime*2.1;
    float breaker=(sin(phase)+.22*sin(phase*2.))*.28*min(1.,uAmplitude)*smoothstep(0.,3.,distance)*(1.-smoothstep(10.,20.,distance));
    float water=height*smoothstep(0.,24.,distance)+breaker;
    return min(water,.08+max(0.,distance)*.12);
  }
`;
