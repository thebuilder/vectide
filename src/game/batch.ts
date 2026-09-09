import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake static transforms and combine identical materials to keep scenery draw calls bounded. */
export function batchStatic(root: T.Group, excluded: T.Object3D[]): void {
  root.updateMatrixWorld(true);
  const skip = new Set<T.Object3D>();
  excluded.forEach((o) => o.traverse((child) => skip.add(child)));
  const batches = new Map<
    string,
    { geometries: T.BufferGeometry[]; material: T.Material; lines: boolean }
  >();
  const remove: T.Object3D[] = [];
  root.traverse((o) => {
    if (
      skip.has(o) ||
      (!(o instanceof T.Mesh) && !(o instanceof T.LineSegments)) ||
      Array.isArray(o.material)
    )
      return;
    const m = o.material;
    if (!(m instanceof T.MeshStandardMaterial) && !(m instanceof T.LineBasicMaterial)) return;
    const lines = o instanceof T.LineSegments;
    const key = [
      lines,
      m.color.getHex(),
      m.opacity,
      m.transparent,
      m.side,
      m.vertexColors,
      m.toneMapped,
      m.name,
      m.polygonOffset,
      m.polygonOffsetFactor,
      m.polygonOffsetUnits,
      m instanceof T.MeshStandardMaterial
        ? `${m.emissive.getHex()},${m.emissiveIntensity},${m.roughness},${m.metalness}`
        : '',
    ].join('/');
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    Object.keys(g.attributes).forEach((a) => {
      if (a !== 'position' && a !== 'normal' && !(a === 'color' && m.vertexColors))
        g.deleteAttribute(a);
    });
    g.applyMatrix4(o.matrixWorld);
    const batch = batches.get(key) ?? { geometries: [], material: m, lines };
    batch.geometries.push(g);
    batches.set(key, batch);
    remove.push(o);
  });
  remove.forEach((o) => {
    o.removeFromParent();
    if (o instanceof T.Mesh || o instanceof T.LineSegments) o.geometry.dispose();
  });
  for (const b of batches.values()) {
    const geometry = mergeGeometries(b.geometries);
    if (!geometry) throw new Error('Could not batch scenery geometry');
    root.add(b.lines ? new T.LineSegments(geometry, b.material) : new T.Mesh(geometry, b.material));
    b.geometries.forEach((g) => g.dispose());
  }
}
