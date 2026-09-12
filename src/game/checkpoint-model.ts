import * as T from 'three';
import { batchStatic } from './batch';
import { dark } from './geometry';

/** The flag and its brackets extend outward, clear of the racing opening. */
export const CHECKPOINT_POST_REACH = 3.6;
export const CHECKPOINT_POST_DEPTH = 1.3;

export function createCheckpointPost(color: number) {
  const group = new T.Group();
  group.name = 'buoy';
  const trim = new T.MeshStandardMaterial({
    color: 0x46646b,
    metalness: 0.65,
    roughness: 0.45,
    flatShading: true,
  });
  const fabric = new T.MeshBasicMaterial({ color, side: T.DoubleSide, toneMapped: false });
  const beaconMaterial = new T.MeshBasicMaterial({ color, toneMapped: false });
  const add = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z = 0) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  add(new T.CylinderGeometry(0.75, 1.25, 0.7, 6), dark, 0, 0.4);
  add(new T.CylinderGeometry(0.9, 1.05, 0.12, 6), fabric, 0, 0.65);
  add(new T.CylinderGeometry(0.15, 0.22, 7.8, 6), trim, 0, 4.55);
  add(new T.CylinderGeometry(0.35, 0.35, 0.25, 6), dark, 0, 8.45);
  for (const y of [4.1, 7.7]) add(new T.BoxGeometry(0.85, 0.13, 0.15), trim, 0.3, y);

  const cloth = new T.PlaneGeometry(2.9, 3.6, 20, 24).translate(1.45, -1.8, 0);
  const vertices = cloth.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const v = -vertices.getY(i) / 3.6;
    // The free edge has a shallow swallowtail; the mast edge stays straight.
    vertices.setX(i, vertices.getX(i) * (1 - (0.6 / 2.9) * (1 - Math.abs(v * 2 - 1))));
  }
  const rest = Float32Array.from(vertices.array);
  const paint = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const u = x / 127 - 0.5,
        v = y / 127;
      const marked =
        Math.abs(u) < 0.24 &&
        [0.35, 0.57].some((row) => Math.abs(v - row - Math.abs(u) * 0.65) < 0.035);
      const offset = (y * 128 + x) * 4;
      paint.set(marked ? [7, 23, 30, 255] : [255, 255, 255, 255], offset);
    }
  }
  const emblem = new T.DataTexture(paint, 128, 128);
  emblem.colorSpace = T.SRGBColorSpace;
  emblem.magFilter = T.LinearFilter;
  emblem.minFilter = T.LinearFilter;
  emblem.needsUpdate = true;
  const clothMaterial = new T.MeshStandardMaterial({
    color,
    map: emblem,
    side: T.DoubleSide,
    roughness: 1,
  });
  clothMaterial.addEventListener('dispose', () => emblem.dispose());
  const flag = new T.Mesh(cloth, clothMaterial);
  flag.name = 'flag';
  flag.position.set(0.65, 7.7, 0);
  group.add(flag);
  const ripple = (time: number) => {
    for (let i = 0; i < vertices.count; i++) {
      const x = rest[i * 3],
        y = rest[i * 3 + 1],
        free = x / 2.9;
      vertices.setY(i, y - free * 0.12);
      vertices.setZ(
        i,
        free *
          (Math.sin(x * 3.3 + y * 1.6 - time * 2.8) * 0.18 +
            Math.sin(x * 6 - y * 0.9 - time * 4.2) * 0.07),
      );
    }
    vertices.needsUpdate = true;
    cloth.computeVertexNormals();
  };
  ripple(0);
  // Deformation stays inside this fixed bound, including the free-edge ripple.
  cloth.boundingSphere = new T.Sphere(new T.Vector3(1.45, -1.86, 0), 2.5);
  let lastRippleTime = 0;

  const beacon = new T.Group();
  beacon.name = 'beacon';
  beacon.position.y = 8.75;
  beacon.add(new T.Mesh(new T.OctahedronGeometry(0.45), beaconMaterial));
  const rotor = new T.Group();
  rotor.name = 'beacon-ring';
  const arc = new T.Mesh(new T.TorusGeometry(0.72, 0.09, 6, 24), beaconMaterial);
  arc.rotation.x = Math.PI / 2;
  rotor.add(arc);
  beacon.add(rotor);
  group.add(beacon);
  batchStatic(group, [flag, beacon]);

  return {
    group,
    update(time: number, active: boolean, beat: number, reducedMotion: boolean) {
      const pulse = active && !reducedMotion ? Math.min(1, Math.max(0, beat)) : 0;
      const motion = active && !reducedMotion;
      const rippleTime = motion ? time : 0;
      if (rippleTime !== lastRippleTime) {
        ripple(rippleTime);
        lastRippleTime = rippleTime;
      }
      rotor.rotation.y = motion ? time * 0.9 : 0;
      rotor.scale.setScalar(active ? 1 + pulse * 0.18 : 0.85);
      beaconMaterial.color.setHex(color).multiplyScalar(active ? 1 + pulse * 0.75 : 0.4);
    },
  };
}
