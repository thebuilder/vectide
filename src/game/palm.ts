import * as T from 'three';
export function createPalm(height: number, bend: number, rotation: number) {
  const palm = new T.Group();
  palm.name = 'Palm';
  palm.rotation.y = rotation;
  const trunkGeometry = new T.CylinderGeometry(0.075, 0.2, height, 6, 7);
  const trunkPoints = trunkGeometry.attributes.position;
  for (let i = 0; i < trunkPoints.count; i++) {
    const t = (trunkPoints.getY(i) + height / 2) / height;
    trunkPoints.setXYZ(i, trunkPoints.getX(i) + bend * t * t, height * t, trunkPoints.getZ(i));
  }
  trunkGeometry.computeVertexNormals();
  const trunk = new T.Mesh(
    trunkGeometry,
    new T.MeshStandardMaterial({ color: 0x71604a, flatShading: true, roughness: 1 }),
  );
  trunk.name = 'Palm trunk';
  palm.add(trunk);
  const vertices: number[] = [],
    colors: number[] = [];
  const leafColors = [0x1e5142, 0x2c6950, 0x376c4d].map((c) => new T.Color(c));
  const triangle = (a: T.Vector3, b: T.Vector3, c: T.Vector3, color: T.Color) => {
    vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  for (let k = 0; k < 9; k++) {
    const angle = (k * Math.PI * 2) / 9 + Math.sin(k * 3.7 + rotation) * 0.12;
    const length = height * (0.43 + 0.1 * Math.sin(k * 2.4 + rotation) ** 2);
    const point = (t: number, side: number) => {
      const width = Math.sin(Math.PI * t) * height * 0.065 * (1 - (Math.round(t * 8) % 2) * 0.22);
      const y =
        height + Math.sin(t * Math.PI) * height * 0.085 - t * t * height * (0.12 + (k % 3) * 0.025);
      return new T.Vector3(
        bend + Math.cos(angle) * length * t - Math.sin(angle) * width * side,
        y - Math.abs(side) * 0.12,
        Math.sin(angle) * length * t + Math.cos(angle) * width * side,
      );
    };
    for (let i = 0; i < 8; i++) {
      const t = i / 8,
        next = (i + 1) / 8;
      for (const side of [-1, 1]) {
        const a = point(t, 0),
          b = point(t, side),
          c = point(next, side),
          d = point(next, 0);
        triangle(a, b, c, leafColors[k % 3]);
        triangle(a, c, d, leafColors[k % 3]);
      }
    }
  }
  const fronds = new T.BufferGeometry();
  fronds.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  fronds.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  fronds.computeVertexNormals();
  const crown = new T.Mesh(
    fronds,
    new T.MeshStandardMaterial({
      vertexColors: true,
      side: T.DoubleSide,
      flatShading: true,
      roughness: 0.9,
    }),
  );
  crown.name = 'Palm fronds';
  palm.add(crown);
  return palm;
}
