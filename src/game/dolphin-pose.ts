import * as T from 'three';

/** Shared breach and tail-stroke poses keep the body and fins connected without per-frame geometry work. */
export function addDolphinBend(model: T.Group) {
  const point = new T.Vector3();
  for (const part of model.children) {
    if (!(part instanceof T.Mesh || part instanceof T.Line)) continue;
    part.updateMatrix();
    const inverse = part.matrix.clone().invert();
    const targets = [-0.5, 0.5, -0.65, 0.65].map((curvature, pose) => {
      const target = part.geometry.clone();
      const position = target.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(part.matrix);
        const tail = pose >= 2;
        const root = tail ? -0.35 : 0;
        if (tail && point.z > root) continue;
        point.z -= root;
        const angle = curvature * point.z;
        const y = point.y;
        point.y = (1 - Math.cos(angle)) / curvature + y * Math.cos(angle);
        point.z = Math.sin(angle) / curvature - y * Math.sin(angle);
        point.z += root;
        point.applyMatrix4(inverse);
        position.setXYZ(i, point.x, point.y, point.z);
      }
      if (part instanceof T.Mesh) target.computeVertexNormals();
      return target;
    });
    part.geometry.morphAttributes.position = targets.map((target) =>
      target.getAttribute('position'),
    );
    if (part instanceof T.Mesh)
      part.geometry.morphAttributes.normal = targets.map((target) => target.getAttribute('normal'));
    part.geometry.computeBoundingBox();
    part.geometry.computeBoundingSphere();
    part.updateMorphTargets();
  }
}

export function poseDolphin(model: T.Group, age: number, duration = 2.5, stroke = age * 7) {
  const phase = Math.min(Math.max(age / duration, 0), 1);
  const swimming = T.MathUtils.smoothstep(age, duration, duration + 0.3);
  const bend =
    (1 - swimming) * (0.85 * Math.cos(phase * Math.PI) - 0.7 * Math.sin(phase * Math.PI));
  const tail = swimming * Math.sin(stroke) * 0.7;
  for (const part of model.children) {
    if (!(part instanceof T.Mesh || part instanceof T.Line)) continue;
    // Line.copy does not copy morph weights, so cloned mouths initialize them once.
    if (!part.morphTargetInfluences) part.updateMorphTargets();
    part.morphTargetInfluences![0] = Math.max(0, -bend);
    part.morphTargetInfluences![1] = Math.max(0, bend);
    part.morphTargetInfluences![2] = Math.max(0, -tail);
    part.morphTargetInfluences![3] = Math.max(0, tail);
  }
}
