import * as T from 'three';
export const dark = new T.MeshStandardMaterial({
  color: 0x07171e,
  roughness: 0.52,
  metalness: 0.35,
  flatShading: true,
});
export function glowing(color: T.ColorRepresentation, intensity = 1) {
  return new T.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.5,
    flatShading: true,
  });
}
export function outlined(
  geometry: T.BufferGeometry,
  color: T.ColorRepresentation,
  solid: T.Material = dark,
): T.Group {
  const g = new T.Group();
  g.add(new T.Mesh(geometry, solid));
  g.add(
    new T.LineSegments(
      new T.EdgesGeometry(geometry, 25),
      new T.LineBasicMaterial({ color, transparent: true, opacity: 0.65 }),
    ),
  );
  return g;
}
export function box(
  parent: T.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: T.ColorRepresentation,
  material?: T.Material,
) {
  const b = outlined(new T.BoxGeometry(w, h, d), color, material);
  b.position.set(x, y, z);
  parent.add(b);
  return b;
}
