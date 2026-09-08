import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { ScanIntro } from '../src/game/intro';
import type { World } from '../src/game/visuals';
it('wire vertices follow hull bob, tilt and articulated rider transforms in the same batch', () => {
  vi.stubGlobal('document', { hidden: false });
  try {
    const scene = new T.Scene(),
      jet = new T.Group(),
      arm = new T.Group();
    const mesh = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshStandardMaterial());
    scene.add(jet);
    jet.add(arm);
    arm.add(mesh);
    const world = {
      waterMaterial: new T.ShaderMaterial({ uniforms: { uIntro: { value: 1 } } }),
    } as World;
    const intro = new ScanIntro(scene, false, world, [jet]);
    const wire = scene.children.find((o) => o instanceof T.LineSegments) as T.LineSegments;
    const local = new T.EdgesGeometry(mesh.geometry, 25).getAttribute('position');
    for (let frame = 0; frame < 30; frame++) {
      jet.position.y = Math.sin(frame * 0.2) * 2;
      jet.rotation.set(0.3, frame * 0.1, -0.2);
      arm.rotation.z = frame * 0.03;
      arm.position.set(0.2, 1.5, -0.3);
      intro.update(1 / 60);
      const positions = wire.geometry.getAttribute('position');
      for (let i = 0; i < local.count; i++) {
        const expected = new T.Vector3()
          .fromBufferAttribute(local, i)
          .applyMatrix4(mesh.matrixWorld);
        expect(new T.Vector3().fromBufferAttribute(positions, i).distanceTo(expected)).toBeLessThan(
          0.00001,
        );
      }
    }
    expect(intro.cageCount).toBe(1);
    intro.finish();
    expect(intro.cageCount).toBe(0);
    expect(wire.parent).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
