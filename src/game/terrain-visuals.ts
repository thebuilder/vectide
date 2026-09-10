import * as T from 'three';
import type { Track } from './tracks';
import { box, dark, glowing, outlined } from './geometry';
import { createPalm } from './palm';

/** Course-owned outlines are also the visible bank edges. The lower ring forms the shore slope. */
export function addTerrain(parent: T.Group, track: Track): T.Group[] {
  const turbines: T.Group[] = [];
  for (const [index, land] of track.land.entries()) {
    const radius = Math.min(
      ...land.outline.map((p, i) => {
        const q = land.outline[(i + 1) % land.outline.length];
        return (
          Math.abs((q.x - p.x) * (land.z - p.z) - (q.z - p.z) * (land.x - p.x)) /
          Math.hypot(q.x - p.x, q.z - p.z)
        );
      }),
    );
    const positions: number[] = [],
      colors: number[] = [];
    const sand = new T.Color(
      land.kind === 'island' ? '#b89c6c' : land.kind === 'dock' ? '#283944' : '#334951',
    );
    const top = new T.Color(
      land.kind === 'island' ? '#284b37' : land.kind === 'dock' ? '#35474b' : '#42636a',
    );
    const triangle = (a: number[], b: number[], c: number[], color: T.Color) => {
      positions.push(...a, ...b, ...c);
      for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
    };
    for (let i = 0; i < land.outline.length; i++) {
      const p = land.outline[i],
        q = land.outline[(i + 1) % land.outline.length];
      const a = [p.x, land.height, p.z],
        b = [q.x, land.height, q.z];
      const c = [land.x, land.height, land.z];
      const shade = 0.82 + ((i * 7 + index * 3) % 9) * 0.045;
      triangle(c, b, a, top.clone().multiplyScalar(shade));
      const scale = land.kind === 'dock' ? 1 : 1.08;
      const lowP = [land.x + (p.x - land.x) * scale, -4, p.z + (p.z - land.z) * (scale - 1)];
      const lowQ = [land.x + (q.x - land.x) * scale, -4, q.z + (q.z - land.z) * (scale - 1)];
      const mid = (point: number[], n: number) => [
        land.x + (point[0] - land.x) * 1.035,
        land.height * (0.38 + ((n + index) % 3) * 0.08),
        land.z + (point[2] - land.z) * 1.035,
      ];
      const midP = mid(a, i),
        midQ = mid(b, (i + 1) % land.outline.length);
      if (land.kind === 'dock') {
        triangle(a, b, lowQ, sand);
        triangle(a, lowQ, lowP, sand);
      } else {
        const upper = sand.clone().lerp(top, 0.3).multiplyScalar(shade);
        const lower = sand.clone().multiplyScalar(0.85 + ((i + index) % 4) * 0.08);
        triangle(a, b, midQ, upper);
        triangle(a, midQ, midP, upper);
        triangle(midP, midQ, lowQ, lower);
        triangle(midP, lowQ, lowP, lower);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const shore = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.93,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        side: T.DoubleSide,
      }),
    );
    shore.name = `Terrain: ${land.name}`;
    parent.add(shore);
    const wire = new T.LineSegments(
      new T.WireframeGeometry(geo),
      new T.LineBasicMaterial({
        name: land.kind === 'island' ? 'sand-wire' : 'terrain-wire',
        color: land.kind === 'island' ? 0xb49a70 : track.accent,
        transparent: true,
        opacity: 0.12,
        toneMapped: false,
      }),
    );
    parent.add(wire);
    if (land.name === 'Lookout point') {
      const resort = new T.Group();
      resort.name = 'Reef lookout resort';
      resort.position.set(land.x, land.height, land.z);
      resort.rotation.y = -0.25;
      // Fit the entire rotated footprint, including balconies, on its supporting island.
      resort.scale.setScalar(Math.min(1, (radius * 0.85) / Math.hypot(32, 19.5)));
      box(resort, 60, 15, 34, 0, 7.5, 0, 0xd8bba0);
      box(resort, 64, 1.5, 38, 0, 15.5, 0, 0x694a47);
      for (let floor = 0; floor < 3; floor++) {
        box(resort, 57, 2.2, 0.3, 0, 3 + floor * 4.4, 17.2, 0x245d64);
        box(
          resort,
          60,
          0.3,
          3,
          0,
          1.5 + floor * 4.4,
          18,
          track.accent,
          glowing(track.accent, 0.25),
        );
      }
      parent.add(resort);
    }
    if (land.kind === 'island') {
      for (let n = 0; n < 8; n++) {
        const point = land.outline[(n * 3 + index) % land.outline.length];
        const inset = land.name === 'Lookout point' ? 0.9 : 0.62;
        const tree = createPalm(9 + (n % 3) * 3, 1.4, (n * 2.4 + index) % 6.28);
        tree.position.set(
          land.x + (point.x - land.x) * inset,
          land.height,
          land.z + (point.z - land.z) * inset,
        );
        parent.add(tree);
      }
      if (land.name !== 'Lookout point') {
        const height = 9 + (index % 2) * 7;
        const hill = outlined(
          new T.ConeGeometry(Math.min(14 + (index % 3) * 6, radius * 0.75), height, 5),
          track.accent,
          new T.MeshStandardMaterial({ color: 0x355a3c, flatShading: true, roughness: 1 }),
        );
        hill.name = `Hill: ${land.name}`;
        hill.position.set(land.x, land.height + height / 2 - 0.2, land.z);
        parent.add(hill);
      }
    } else if (land.kind === 'dock') {
      const long =
        land.outline.length === 4
          ? Math.hypot(land.outline[1].x - land.outline[0].x, land.outline[1].z - land.outline[0].z)
          : 20;
      for (let n = -1; n <= 1; n++) {
        box(
          parent,
          Math.min(15, long * 0.3),
          5,
          9,
          land.x + n * Math.min(18, long * 0.3),
          land.height + 2.5,
          land.z,
          n % 2 ? 0x8a5e4b : 0x536278,
        );
      }
      if (index % 3 === 2) {
        box(parent, 1.7, 38, 1.7, land.x, land.height + 19, land.z, track.accent);
        box(parent, 34, 1.3, 1.3, land.x + 8, land.height + 37, land.z, track.accent);
        box(
          parent,
          0.15,
          18,
          0.15,
          land.x + 21,
          land.height + 28,
          land.z,
          0xffbc57,
          glowing(0xffbc57, 0.25),
        );
      }
      // Quay edge lights follow its real outline rather than a separate decorative corridor.
      land.outline.forEach((p) =>
        box(
          parent,
          0.45,
          0.65,
          0.45,
          p.x,
          land.height + 0.35,
          p.z,
          track.accent,
          glowing(track.accent, 0.4),
        ),
      );
    } else {
      const pole = new T.Mesh(new T.CylinderGeometry(0.7, 1.3, 42, 7), dark);
      pole.position.set(land.x, land.height + 21, land.z);
      parent.add(pole);
      const rotor = new T.Group();
      rotor.position.set(land.x, land.height + 41, land.z);
      parent.add(rotor);
      turbines.push(rotor);
      for (let k = 0; k < 3; k++) {
        const arm = new T.Group();
        arm.rotation.z = (k * Math.PI * 2) / 3;
        box(arm, 1.3, 22, 0.7, 0, 11, 0, track.accent);
        rotor.add(arm);
      }
    }
  }
  return turbines;
}
