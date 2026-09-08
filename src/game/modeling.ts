import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export interface Section {
  at: number;
  width: number;
  depth: number;
  shift?: number;
}
/** Faceted cross-sections make shaped anatomy and bodywork without texture dependencies. */
export function loft(sections: Section[], sides = 10, axis: 'y' | 'z' = 'y'): T.BufferGeometry {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const s of sections)
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        x = Math.cos(a) * s.width,
        other = Math.sin(a) * s.depth;
      if (axis === 'y') vertices.push(x, s.at, other + (s.shift ?? 0));
      else vertices.push(x, other + (s.shift ?? 0), s.at);
    }
  for (let row = 0; row < sections.length - 1; row++)
    for (let i = 0; i < sides; i++) {
      const a = row * sides + i,
        b = row * sides + ((i + 1) % sides),
        c = a + sides,
        d = b + sides;
      if (axis === 'y') indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  // Each end has a center vertex, so all closed parts retain solid silhouettes.
  for (const end of [0, sections.length - 1]) {
    const s = sections[end],
      center = vertices.length / 3;
    if (axis === 'y') vertices.push(0, s.at, s.shift ?? 0);
    else vertices.push(0, s.shift ?? 0, s.at);
    for (let i = 0; i < sides; i++) {
      const a = end * sides + i,
        b = end * sides + ((i + 1) % sides);
      const reverse = (end === 0) === (axis === 'y');
      if (reverse) indices.push(center, a, b);
      else indices.push(center, b, a);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
export function panel(
  parent: T.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: T.Material,
  radius = 0.035,
): T.Mesh {
  const mesh = new T.Mesh(
    new RoundedBoxGeometry(...size, 1, Math.min(radius, ...size.map((v) => v / 3))),
    material,
  );
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
export function rod(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  radius: number,
  material: T.Material,
  sides = 8,
): T.Mesh {
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, a.distanceTo(b), sides), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(mesh);
  return mesh;
}
