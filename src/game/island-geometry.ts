import * as T from 'three';
import type { Landform } from './course-layout';

/** Low faceted ground rises behind a narrow beach; the dry bank follows the collision outline. */
export function islandGeometry(land: Landform, seed: number): T.BufferGeometry {
  const edge = land.outline.flatMap((p, i) => {
    const q = land.outline[(i + 1) % land.outline.length];
    return [0, 1 / 3, 2 / 3].map((t) => ({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t }));
  });
  const rings = [1.065, 1, 0.9, 0.72, 0.46, 0.2];
  const positions: number[] = [],
    colors: number[] = [];
  const palette = ['#526b63', '#aa9672', '#857f51', '#254c3c', '#244536', '#30483e'].map(
    (c) => new T.Color(c),
  );
  const point = (ring: number, i: number): T.Vector3 => {
    const p = edge[i % edge.length],
      scale = rings[ring];
    const x = land.x + (p.x - land.x) * scale,
      z = land.z + (p.z - land.z) * scale;
    const variation = 0.72 + 0.18 * Math.sin(i * 1.73 + seed) + 0.1 * Math.cos(i * 0.83 - seed);
    let y = ring === 0 ? -1.2 : ring === 1 ? 0.45 : ring === 2 ? 0.85 : land.height * variation;
    if (land.name === 'Lookout point' && ring >= 3) y = land.height;
    return new T.Vector3(x, y, z);
  };
  const triangle = (a: T.Vector3, b: T.Vector3, c: T.Vector3, color: T.Color, shade: number) => {
    positions.push(...a.toArray(), ...c.toArray(), ...b.toArray());
    for (let i = 0; i < 3; i++) colors.push(color.r * shade, color.g * shade, color.b * shade);
  };
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let i = 0; i < edge.length; i++) {
      const a = point(ring, i),
        b = point(ring, i + 1),
        c = point(ring + 1, i),
        d = point(ring + 1, i + 1);
      const shade = 0.86 + ((i * 7 + ring * 3 + seed) % 9) * 0.033;
      triangle(a, b, c, palette[ring], shade);
      triangle(b, d, c, palette[ring], shade * 0.96);
    }
  const center = new T.Vector3(
    land.x,
    land.height * (land.name === 'Lookout point' ? 1 : 0.86),
    land.z,
  );
  for (let i = 0; i < edge.length; i++)
    triangle(point(5, i), point(5, i + 1), center, palette[5], 0.9 + (i % 3) * 0.06);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
