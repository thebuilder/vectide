import * as T from 'three';
export function createPalm(height: number, bend: number, rotation: number) {
  const palm = new T.Group();
  palm.rotation.y = rotation;
  const trunkMaterial = new T.MeshStandardMaterial({ color: 0x79604c, flatShading: true });
  const points = Array.from(
    { length: 7 },
    (_, i) => new T.Vector3(bend * (i / 6) ** 2, (height * i) / 6, 0),
  );
  const curve = new T.CatmullRomCurve3(points);
  palm.add(new T.Mesh(new T.TubeGeometry(curve, 6, 0.3, 5, false), trunkMaterial));
  for (let k = 0; k < 7; k++) {
    const a = (k * Math.PI * 2) / 7,
      vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6,
        length = height * 0.55 * t,
        width = Math.sin(Math.PI * t) * 0.65;
      const y = height + Math.sin(t * Math.PI) * 1.2 - t * t * 2;
      for (const side of [-1, 1])
        vertices.push(
          bend + Math.cos(a) * length - Math.sin(a) * width * side,
          y,
          Math.sin(a) * length + Math.cos(a) * width * side,
        );
      if (i < 6) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    palm.add(
      new T.Mesh(
        g,
        new T.MeshStandardMaterial({
          color: k % 2 ? 0x348b70 : 0x246c59,
          side: T.DoubleSide,
          flatShading: true,
        }),
      ),
    );
  }
  return palm;
}
